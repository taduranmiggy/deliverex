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
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfflineActionTimestampTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_status_update_uses_action_timestamp_for_operational_timeline(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::EN_ROUTE_TO_DESTINATION);

        $actionTimestamp = '2026-06-29T10:15:00.000Z';

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id'    => $assignment->id,
            'status'           => DeliveryStatus::ARRIVED,
            'latitude'         => 14.5995,
            'longitude'        => 120.9842,
            'action_timestamp' => $actionTimestamp,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', DeliveryStatus::ARRIVED)
            ->assertJsonPath('event_at', '2026-06-29T10:15:00+00:00')
            ->assertJsonPath('synced_at', '2026-06-29T10:30:00+00:00')
            ->assertJsonPath('performed_offline', true);

        $this->assertDatabaseHas('delivery_status_logs', [
            'assignment_id' => $assignment->id,
            'status'        => DeliveryStatus::ARRIVED,
            'created_at'    => '2026-06-29 10:15:00',
            'synced_at'     => '2026-06-29 10:30:00',
        ]);

        $this->assertDatabaseHas('delivery_status_history', [
            'assignment_id' => $assignment->id,
            'status'        => DeliveryStatus::ARRIVED,
            'updated_at'    => '2026-06-29 10:15:00',
            'created_at'    => '2026-06-29 10:15:00',
        ]);

        $this->assertDatabaseHas('tracking_logs', [
            'assignment_id' => $assignment->id,
            'captured_at'   => '2026-06-29 10:15:00',
        ]);

        $log = DeliveryStatusLog::query()
            ->where('assignment_id', $assignment->id)
            ->where('status', DeliveryStatus::ARRIVED)
            ->first();

        $this->assertNotNull($log);
        $this->assertNotSame(
            Carbon::parse('2026-06-29 10:30:00')->timestamp,
            $log->created_at->timestamp,
        );
    }

    public function test_status_update_falls_back_to_server_time_for_invalid_action_timestamp(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::ARRIVED_AT_PICKUP);

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id'    => $assignment->id,
            'status'           => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            'action_timestamp' => 'definitely-not-iso8601',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('delivery_status_logs', [
            'assignment_id' => $assignment->id,
            'status'        => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            'created_at'    => '2026-06-29 10:30:00',
            'synced_at'     => null,
        ]);
    }

    public function test_tracking_api_exposes_event_at_and_synced_at_on_timeline(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::EN_ROUTE_TO_DESTINATION);
        $jobOrder = $assignment->jobOrder;

        $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id'    => $assignment->id,
            'status'           => DeliveryStatus::ARRIVED,
            'latitude'         => 14.5995,
            'longitude'        => 120.9842,
            'action_timestamp' => '2026-06-29T10:15:00.000Z',
        ])->assertOk();

        $response = $this->getJson('/api/customer/track/'.$jobOrder->tracking_code);

        $response->assertOk();

        $arrivedEvent = collect($response->json('status_events'))
            ->firstWhere('status', DeliveryStatus::ARRIVED);

        $this->assertNotNull($arrivedEvent);
        $this->assertSame('2026-06-29T10:15:00+00:00', $arrivedEvent['event_at']);
        $this->assertSame('2026-06-29T10:30:00+00:00', $arrivedEvent['synced_at']);
        $this->assertTrue($arrivedEvent['performed_offline']);
    }

    public function test_started_at_uses_action_timestamp_when_trip_starts_offline(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::ASSIGNED);

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/status', [
            'assignment_id'    => $assignment->id,
            'status'           => DeliveryStatus::EN_ROUTE_TO_PICKUP,
            'latitude'         => 14.5995,
            'longitude'        => 120.9842,
            'action_timestamp' => '2026-06-29T10:05:00.000Z',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('dispatch_assignments', [
            'id'         => $assignment->id,
            'started_at' => '2026-06-29 10:05:00',
        ]);
    }

    /**
     * @return array{0:User,1:DispatchAssignment}
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
            'license_no' => 'TEST-LIC-OFFLINE',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'OFF-1234',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'status' => DeliveryStatus::toJobOrderStatus($status),
            'scheduled_start' => now()->subHour(),
            'scheduled_end' => now()->addHours(3),
            'dropoff_latitude' => 14.5995,
            'dropoff_longitude' => 120.9842,
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
            'notes' => 'Assigned for offline timestamp test',
            'created_at' => now()->subHours(2),
        ]);

        DeliveryStatusHistory::create([
            'job_order_id' => $jobOrder->id,
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ASSIGNED,
            'updated_by' => $dispatcher->id,
            'updated_at' => now()->subHours(2),
            'remarks' => 'Assigned for offline timestamp test',
            'created_at' => now()->subHours(2),
        ]);

        return [$driverUser, $assignment];
    }
}
