<?php

namespace Tests\Feature;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\TrackingLog;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GpsTrackingTest extends TestCase
{
    use RefreshDatabase;

    private User $driverUser;

    private Driver $driver;

    private DispatchAssignment $assignment;

    protected function setUp(): void
    {
        parent::setUp();

        $driverRole = Role::create(['name' => 'driver']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $dispatcher = User::factory()->create(['role_id' => $dispatcherRole->id, 'email_verified_at' => now()]);

        $this->driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        $this->driver = Driver::create([
            'user_id' => $this->driverUser->id,
            'license_no' => 'GPS-LIC-001',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'GPS-1001',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'in_operation',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'status' => 'in_progress',
            'dropoff_latitude' => 14.5995,
            'dropoff_longitude' => 120.9842,
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $this->assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            'assigned_at' => now(),
        ]);
    }

    public function test_scenario_a_driver_gps_update_is_recorded(): void
    {
        $response = $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_m' => 8.5,
            'heading' => 90,
            'speed_kmh' => 25,
            'captured_at' => now()->toIso8601String(),
        ]);

        $response->assertCreated()
            ->assertJsonPath('latitude', 14.5995)
            ->assertJsonPath('longitude', 120.9842);

        $this->assertDatabaseHas('tracking_logs', [
            'assignment_id' => $this->assignment->id,
            'driver_id' => $this->driver->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ]);
    }

    public function test_scenario_b_offline_timestamp_preserved_on_sync(): void
    {
        $captured = now()->subMinutes(20)->toIso8601String();

        $response = $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.6001,
            'longitude' => 120.9850,
            'action_timestamp' => $captured,
        ]);

        $response->assertCreated();

        $log = TrackingLog::query()->where('assignment_id', $this->assignment->id)->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame(
            now()->subMinutes(20)->format('Y-m-d H:i'),
            $log->captured_at->format('Y-m-d H:i'),
        );
        $this->assertNotNull($log->synced_at);
    }

    public function test_scenario_c_duplicate_coordinates_are_skipped(): void
    {
        $payload = [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'captured_at' => now()->toIso8601String(),
        ];

        $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', $payload)->assertCreated();
        $second = $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', $payload);

        $second->assertOk()->assertJsonPath('skipped', true);
        $this->assertSame(1, TrackingLog::query()->where('assignment_id', $this->assignment->id)->count());
    }

    public function test_scenario_d_customer_tracking_includes_location_timestamp(): void
    {
        TrackingLog::create([
            'assignment_id' => $this->assignment->id,
            'driver_id' => $this->driver->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'captured_at' => now()->subMinutes(2),
        ]);

        $jobOrder = $this->assignment->jobOrder;
        $response = $this->getJson('/api/customer/track/'.$jobOrder->tracking_code);

        $response->assertOk()
            ->assertJsonPath('approximate_location.lat', 14.6)
            ->assertJsonPath('approximate_location.lng', 120.98)
            ->assertJsonPath('approximate_location.is_stale', false);

        $this->assertNotNull($response->json('approximate_location.at'));
    }

    public function test_scenario_e_rejects_invalid_coordinates(): void
    {
        $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 0,
            'longitude' => 0,
        ])->assertStatus(422);
    }

    public function test_scenario_f_completed_assignment_rejects_gps(): void
    {
        $this->assignment->update(['status' => DeliveryStatus::COMPLETED]);

        $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ])->assertStatus(422);
    }

    public function test_wrong_driver_cannot_send_gps(): void
    {
        $otherRole = Role::firstOrCreate(['name' => 'driver']);
        $otherDriverUser = User::factory()->create(['role_id' => $otherRole->id, 'email_verified_at' => now()]);
        Driver::create([
            'user_id' => $otherDriverUser->id,
            'license_no' => 'GPS-OTHER',
            'availability' => 'available',
            'status' => 'active',
        ]);

        $this->apiAs($otherDriverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ])->assertForbidden();
    }

    public function test_status_update_with_gps_creates_tracking_log(): void
    {
        $this->assignment->update(['status' => DeliveryStatus::ARRIVED_AT_PICKUP]);

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $this->assignment->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            'latitude' => 14.6010,
            'longitude' => 120.9860,
        ])->assertOk();

        $this->assertDatabaseHas('tracking_logs', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.6010,
            'longitude' => 120.9860,
            'source' => 'status_update:'.DeliveryStatus::EN_ROUTE_TO_DESTINATION,
        ]);
    }
}
