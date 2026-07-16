<?php

namespace Tests\Feature;

use App\Models\DeliveryCompletionProof;
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

class DeliveryLifecycleScenariosTest extends TestCase
{
    use RefreshDatabase;

    private User $dispatcher;

    private User $driverUser;

    private Driver $driver;

    private Vehicle $vehicle;

    protected function setUp(): void
    {
        parent::setUp();

        $driverRole = Role::create(['name' => 'driver']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);

        $this->dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email_verified_at' => now(),
        ]);
        $this->driverUser = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
        ]);

        $this->driver = Driver::create([
            'user_id' => $this->driverUser->id,
            'license_no' => 'LIFE-LIC-001',
            'availability' => 'available',
            'status' => 'active',
        ]);

        $this->vehicle = Vehicle::create([
            'plate_no' => 'LIFE-1001',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);
    }

    public function test_scenario_1_create_assignment_starts_at_assigned(): void
    {
        $jobOrder = $this->createPendingJobOrder();

        $response = $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ]);

        $response->assertCreated();

        $assignmentId = (int) $response->json('id');
        $this->assertDatabaseHas('dispatch_assignments', [
            'id' => $assignmentId,
            'status' => DeliveryStatus::ASSIGNED,
        ]);

        $this->assertDatabaseHas('delivery_status_history', [
            'assignment_id' => $assignmentId,
            'status' => DeliveryStatus::ASSIGNED,
            'previous_status' => null,
            'driver_id' => $this->driver->id,
        ]);
    }

    public function test_scenario_2_driver_starts_pickup(): void
    {
        $assignment = $this->createAssignedJob();

        $response = $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_PICKUP,
            'latitude' => 14.5995,
            'longitude' => 121.0364,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', DeliveryStatus::EN_ROUTE_TO_PICKUP)
            ->assertJsonPath('previous_status', DeliveryStatus::ASSIGNED)
            ->assertJsonPath('allowed_action', 'Arrived at Pickup');

        $this->assertSame('busy', $this->driver->fresh()->availability);
    }

    public function test_scenario_3_driver_arrives_at_pickup(): void
    {
        $assignment = $this->createAssignedJob(DeliveryStatus::EN_ROUTE_TO_PICKUP);

        $response = $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ARRIVED_AT_PICKUP,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', DeliveryStatus::ARRIVED_AT_PICKUP)
            ->assertJsonPath('allowed_action', 'Start Delivery');
    }

    public function test_scenario_4_driver_starts_delivery(): void
    {
        $assignment = $this->createAssignedJob(DeliveryStatus::ARRIVED_AT_PICKUP);

        $response = $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', DeliveryStatus::EN_ROUTE_TO_DESTINATION)
            ->assertJsonPath('allowed_action', 'Arrived at Destination');
    }

    public function test_scenario_5_driver_arrives_at_destination(): void
    {
        $assignment = $this->createAssignedJob(DeliveryStatus::EN_ROUTE_TO_DESTINATION);

        $response = $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ARRIVED_AT_DESTINATION,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', DeliveryStatus::ARRIVED_AT_DESTINATION)
            ->assertJsonPath('allowed_action', 'Complete Delivery');
    }

    public function test_scenario_6_complete_delivery_frees_driver_and_vehicle(): void
    {
        Storage::fake('public');
        $assignment = $this->createAssignedJob(DeliveryStatus::ARRIVED_AT_DESTINATION);

        $this->apiAs($this->driverUser)->postJson('/api/driver/completion-proof', [
            'assignment_id' => $assignment->id,
            'proof_type' => DeliveryCompletionProof::TYPE_RECEIPT_PHOTO,
            'receiver_name' => 'Site Receiver',
            'file' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertCreated();

        $response = $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', DeliveryStatus::COMPLETED)
            ->assertJsonPath('dispatcher_phase', 'completed');

        $this->assertSame('available', $this->driver->fresh()->availability);
        $this->assertSame('available', $this->vehicle->fresh()->status);

        $historyCount = DeliveryStatusHistory::query()
            ->where('assignment_id', $assignment->id)
            ->count();

        $this->assertGreaterThanOrEqual(2, $historyCount);
    }

    public function test_invalid_skip_transition_is_rejected(): void
    {
        $assignment = $this->createAssignedJob(DeliveryStatus::ASSIGNED);

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
        ])->assertStatus(422);
    }

    public function test_legacy_arrived_at_pickup_when_en_route_to_pickup(): void
    {
        $assignment = $this->createAssignedJob(DeliveryStatus::EN_ROUTE_TO_PICKUP);

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => 'arrived',
        ])->assertOk()->assertJsonPath('status', DeliveryStatus::ARRIVED_AT_PICKUP);
    }

    public function test_legacy_arrived_at_destination_when_en_route_to_destination(): void
    {
        $assignment = $this->createAssignedJob(DeliveryStatus::EN_ROUTE_TO_DESTINATION);

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => 'arrived',
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ])->assertOk()->assertJsonPath('status', DeliveryStatus::ARRIVED_AT_DESTINATION);
    }

    private function createPendingJobOrder(): JobOrder
    {
        return JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'status' => 'pending',
            'dropoff_latitude' => 14.5995,
            'dropoff_longitude' => 120.9842,
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);
    }

    private function createAssignedJob(string $status = DeliveryStatus::ASSIGNED): DispatchAssignment
    {
        $jobOrder = $this->createPendingJobOrder();

        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])->assertCreated();

        $assignment = DispatchAssignment::query()
            ->where('job_order_id', $jobOrder->id)
            ->firstOrFail();

        if ($status !== DeliveryStatus::ASSIGNED) {
            $this->advanceAssignmentTo($assignment, $status);
            $assignment->refresh();
        }

        $this->driver->refresh();
        $this->vehicle->refresh();

        return $assignment;
    }

    private function advanceAssignmentTo(
        DispatchAssignment $assignment,
        string $targetStatus,
        ?User $driverUser = null,
    ): void {
        $driverUser ??= $this->driverUser;
        $steps = [
            DeliveryStatus::EN_ROUTE_TO_PICKUP => [
                'status' => DeliveryStatus::EN_ROUTE_TO_PICKUP,
                'latitude' => 14.5995,
                'longitude' => 121.0364,
            ],
            DeliveryStatus::ARRIVED_AT_PICKUP => [
                'status' => DeliveryStatus::ARRIVED_AT_PICKUP,
            ],
            DeliveryStatus::EN_ROUTE_TO_DESTINATION => [
                'status' => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            ],
            DeliveryStatus::ARRIVED_AT_DESTINATION => [
                'status' => DeliveryStatus::ARRIVED_AT_DESTINATION,
                'latitude' => 14.5995,
                'longitude' => 120.9842,
            ],
        ];

        foreach (DeliveryStatus::lifecycle() as $stage) {
            if ($stage === DeliveryStatus::ASSIGNED) {
                continue;
            }

            if (! isset($steps[$stage])) {
                continue;
            }

            $this->apiAs($driverUser)->postJson('/api/driver/status', array_merge(
                ['assignment_id' => $assignment->id],
                $steps[$stage],
            ))->assertOk();

            if ($stage === $targetStatus) {
                break;
            }
        }
    }
}
