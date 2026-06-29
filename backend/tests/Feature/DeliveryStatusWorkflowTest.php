<?php

namespace Tests\Feature;

use App\Models\DeliveryStatusHistory;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DeliveryStatusWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_driver_status_rejects_invalid_skip_transition(): void
    {
        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::ASSIGNED);

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Cannot transition', (string) $response->json('message'));
    }

    public function test_driver_legacy_status_actions_map_to_new_lifecycle_and_log_history(): void
    {
        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::ASSIGNED);

        $start = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => 'in_progress',
            'latitude' => 14.1234,
            'longitude' => 121.9876,
        ]);
        $start->assertOk()
            ->assertJsonPath('status', DeliveryStatus::EN_ROUTE_TO_PICKUP)
            ->assertJsonPath('allowed_action', 'Arrived at Pickup');

        $arrivedPickup = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => 'arrived',
        ]);
        $arrivedPickup->assertOk()
            ->assertJsonPath('status', DeliveryStatus::ARRIVED_AT_PICKUP)
            ->assertJsonPath('allowed_action', 'Start Delivery');

        $this->assertDatabaseHas('dispatch_assignments', [
            'id' => $assignment->id,
            'status' => DeliveryStatus::ARRIVED_AT_PICKUP,
        ]);

        $this->assertGreaterThanOrEqual(
            2,
            DeliveryStatusHistory::query()->where('assignment_id', $assignment->id)->count()
        );
    }

    public function test_driver_can_transition_to_en_route_to_destination_after_pickup(): void
    {
        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::ARRIVED_AT_PICKUP);

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', DeliveryStatus::EN_ROUTE_TO_DESTINATION)
            ->assertJsonPath('allowed_action', 'Arrived');

        $this->assertDatabaseHas('dispatch_assignments', [
            'id' => $assignment->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
        ]);
    }

    public function test_driver_document_upload_blocks_ocr_before_arrival(): void
    {
        Storage::fake('public');
        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::EN_ROUTE_TO_PICKUP);

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/documents', [
            'assignment_id' => $assignment->id,
            'type' => 'receipt',
            'file' => UploadedFile::fake()->image('receipt.png'),
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('OCR uploads are only allowed', (string) $response->json('message'));
    }

    public function test_driver_other_document_upload_enters_ocr_review_queue(): void
    {
        Storage::fake('public');
        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::EN_ROUTE_TO_PICKUP);

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/documents', [
            'assignment_id' => $assignment->id,
            'type' => 'other',
            'file' => UploadedFile::fake()->image('misc.png'),
        ]);

        $response->assertCreated()
            ->assertJsonPath('document.type', 'other');

        $documentId = (int) $response->json('document.id');
        $this->assertNotNull($response->json('ocr_result'));
        $this->assertDatabaseHas('ocr_results', [
            'document_id' => $documentId,
            'review_status' => 'pending_review',
        ]);
    }

    public function test_customer_tracking_returns_ordered_status_timeline(): void
    {
        [, $assignment, $jobOrder] = $this->createDriverAssignment(DeliveryStatus::ASSIGNED);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_PICKUP,
            'notes' => 'Driver started pickup',
            'created_at' => now()->addMinutes(5),
        ]);

        $response = $this->getJson('/api/customer/track/'.$jobOrder->tracking_code);

        $response->assertOk()
            ->assertJsonPath('current_status', DeliveryStatus::EN_ROUTE_TO_PICKUP)
            ->assertJsonPath('timeline.0.status', DeliveryStatus::ASSIGNED)
            ->assertJsonPath('timeline.1.status', DeliveryStatus::EN_ROUTE_TO_PICKUP)
            ->assertJsonPath('timeline.2.status', DeliveryStatus::ARRIVED_AT_PICKUP)
            ->assertJsonPath('timeline.3.status', DeliveryStatus::EN_ROUTE_TO_DESTINATION)
            ->assertJsonPath('timeline.4.status', DeliveryStatus::ARRIVED)
            ->assertJsonPath('timeline.5.status', DeliveryStatus::COMPLETED);

        $this->assertNotNull($response->json('timeline.0.timestamp'));
        $this->assertNotNull($response->json('timeline.1.timestamp'));
        $this->assertNull($response->json('timeline.4.timestamp'));
    }

    /**
     * @return array{0:User,1:DispatchAssignment,2:JobOrder}
     */
    private function createDriverAssignment(string $status): array
    {
        $driverRole = Role::create(['name' => 'driver']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);

        $dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email_verified_at' => now(),
        ]);
        $driverUser = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
        ]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'license_no' => 'TEST-LIC-001',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'TSK-1234',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'status' => DeliveryStatus::toJobOrderStatus($status),
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => $status,
            'assigned_at' => now(),
        ]);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ASSIGNED,
            'notes' => 'Assigned for test',
            'created_at' => now(),
        ]);

        DeliveryStatusHistory::create([
            'job_order_id' => $jobOrder->id,
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ASSIGNED,
            'updated_by' => $dispatcher->id,
            'updated_at' => now(),
            'remarks' => 'Assigned for test',
            'created_at' => now(),
        ]);

        return [$driverUser, $assignment, $jobOrder];
    }
}
