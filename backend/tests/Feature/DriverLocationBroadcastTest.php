<?php

namespace Tests\Feature;

use App\Events\DriverLocationUpdated;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class DriverLocationBroadcastTest extends TestCase
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
            'license_no' => 'WS-LIC-001',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'WS-1001',
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

    public function test_gps_ingest_broadcasts_driver_location_updated(): void
    {
        Event::fake([DriverLocationUpdated::class]);

        $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'heading' => 45,
            'speed_kmh' => 32,
            'captured_at' => now()->toIso8601String(),
        ])->assertCreated();

        Event::assertDispatched(DriverLocationUpdated::class, function (DriverLocationUpdated $event) {
            $payload = $event->broadcastWith();

            return $payload['trip_id'] === $this->assignment->id
                && $payload['driver_id'] === $this->driver->id
                && $payload['latitude'] === 14.5995
                && $payload['longitude'] === 120.9842
                && $payload['heading'] === 45.0
                && $payload['timestamp'] !== null;
        });
    }

    public function test_event_broadcasts_on_fleet_and_trip_channels(): void
    {
        Event::fake([DriverLocationUpdated::class]);

        $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 14.6,
            'longitude' => 120.99,
        ])->assertCreated();

        Event::assertDispatched(DriverLocationUpdated::class, function (DriverLocationUpdated $event) {
            $channels = array_map(fn ($c) => $c->name, $event->broadcastOn());

            return in_array('private-fleet.live', $channels, true)
                && in_array('private-trip.'.$this->assignment->id, $channels, true)
                && $event->broadcastAs() === 'driver.location.updated';
        });
    }

    public function test_rejected_ping_does_not_broadcast(): void
    {
        Event::fake([DriverLocationUpdated::class]);

        // Coordinates outside the Philippines are rejected by the validator.
        $this->apiAs($this->driverUser)->postJson('/api/driver/tracking', [
            'assignment_id' => $this->assignment->id,
            'latitude' => 48.8566,
            'longitude' => 2.3522,
        ]);

        Event::assertNotDispatched(DriverLocationUpdated::class);
    }
}
