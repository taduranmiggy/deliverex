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
use App\Support\GpsCoordinateValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FleetLiveTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_fleet_live_returns_active_assignments_with_latest_gps(): void
    {
        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $driverRole = Role::create(['name' => 'driver']);
        $dispatcher = User::factory()->create(['role_id' => $dispatcherRole->id, 'email_verified_at' => now()]);
        $driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'license_no' => 'FLEET-LIC-001',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'FLEET-9001',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'in_operation',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'tracking_code' => 'LIVETRACK1',
            'status' => 'in_progress',
            'pickup_latitude' => 14.5995,
            'pickup_longitude' => 120.9842,
            'dropoff_latitude' => 14.6760,
            'dropoff_longitude' => 121.0437,
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            'assigned_at' => now(),
        ]);

        TrackingLog::create([
            'assignment_id' => $assignment->id,
            'driver_id' => $driver->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'captured_at' => now()->subSeconds(30),
        ]);

        Http::fake([
            'api.openrouteservice.org/*' => Http::response(['features' => []], 200),
            'router.project-osrm.org/*' => Http::response([
                'routes' => [[
                    'distance' => 12000,
                    'duration' => 900,
                    'geometry' => [
                        'coordinates' => [[120.9842, 14.5995], [121.0437, 14.6760]],
                    ],
                ]],
            ], 200),
        ]);

        $response = $this->apiAs($dispatcher)->getJson('/api/dispatch/fleet-live');

        $response->assertOk()
            ->assertJsonPath('data.0.id', $assignment->id)
            ->assertJsonPath('data.0.job_order.tracking_code', 'LIVETRACK1')
            ->assertJsonPath('data.0.location.lat', 14.5995)
            ->assertJsonPath('data.0.location.lng', 120.9842)
            ->assertJsonPath('data.0.pickup.lat', 14.5995)
            ->assertJsonPath('data.0.destination.lat', 14.676)
            ->assertJsonPath('data.0.route.source', 'osrm')
            ->assertJsonPath('data.0.delivery_route.source', 'osrm')
            ->assertJsonPath('data.0.location_status.pickup_resolved', true)
            ->assertJsonPath('data.0.location_status.destination_resolved', true)
            ->assertJsonStructure([
                'synced_at',
                'data' => [[
                    'id',
                    'status',
                    'pickup' => ['lat', 'lng'],
                    'destination' => ['lat', 'lng'],
                    'location' => ['lat', 'lng', 'at', 'offline'],
                    'route' => ['polyline', 'distance_label', 'duration_label', 'source'],
                    'delivery_route' => ['polyline', 'distance_label', 'duration_label', 'source'],
                    'location_status' => [
                        'pickup_resolved',
                        'destination_resolved',
                        'pickup_address',
                        'destination_address',
                        'warnings',
                    ],
                    'driver',
                    'vehicle',
                    'job_order',
                ]],
            ]);
    }

    public function test_coordinate_validator_rejects_null_island_and_outside_philippines(): void
    {
        $this->assertNotNull(GpsCoordinateValidator::validate(0.0, 0.0));
        $this->assertNotNull(GpsCoordinateValidator::validate(40.0, -74.0));
        $this->assertNull(GpsCoordinateValidator::validate(14.5995, 120.9842));
        $this->assertFalse(GpsCoordinateValidator::isUsable(0, 0));
        $this->assertTrue(GpsCoordinateValidator::isUsable(14.5995, 120.9842));
    }
}
