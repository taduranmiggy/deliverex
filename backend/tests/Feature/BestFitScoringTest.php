<?php

namespace Tests\Feature;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\TrackingLog;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use App\Services\Assignment\BestFitAssignmentService;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BestFitScoringTest extends TestCase
{
    use RefreshDatabase;

    private User $dispatcher;

    protected function setUp(): void
    {
        parent::setUp();

        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $this->dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email_verified_at' => now(),
        ]);
    }

    public function test_scenario_a_ranks_drivers_by_capacity_fit_with_meaningful_variation(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $type = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'vehicle_type_required' => 'Dump Truck',
            'load_volume_m3' => 14,
            'dropoff_latitude' => 14.5995,
            'dropoff_longitude' => 121.0364,
            'status' => 'pending',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
        ]);

        $capacities = [15, 18, 22, 30];
        $scores = [];

        foreach ($capacities as $index => $capacity) {
            $user = User::factory()->create([
                'role_id' => $driverRole->id,
                'email_verified_at' => now(),
            ]);

            $driver = Driver::create([
                'user_id' => $user->id,
                'full_name' => "Driver {$capacity}",
                'license_no' => "LIC-{$capacity}",
                'license_expiry' => now()->addYear(),
                'availability' => 'available',
                'status' => 'available',
            ]);

            $vehicle = Vehicle::create([
                'plate_no' => "CAP-{$capacity}",
                'type' => 'Dump Truck',
                'vehicle_type_id' => $type->id,
                'capacity' => "{$capacity} m3",
                'cbm_capacity' => $capacity,
                'status' => 'available',
            ]);

            $pastAssignment = DispatchAssignment::create([
                'job_order_id' => JobOrder::factory()->create(['created_by' => $this->dispatcher->id])->id,
                'driver_id' => $driver->id,
                'vehicle_id' => $vehicle->id,
                'assigned_by' => $this->dispatcher->id,
                'status' => DeliveryStatus::COMPLETED,
                'assigned_at' => now()->subDays(2),
                'completed_at' => now()->subDay(),
            ]);

            TrackingLog::create([
                'assignment_id' => $pastAssignment->id,
                'latitude' => 14.60 + ($index * 0.05),
                'longitude' => 121.04 + ($index * 0.02),
                'captured_at' => now()->subHours(2),
            ]);
        }

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $this->assertGreaterThanOrEqual(3, count($recommendations));

        foreach ($recommendations as $rec) {
            $scores[] = $rec['score'];
            $sum = collect($rec['factors'])->sum('contribution');
            $this->assertSame($rec['score'], $sum, 'Score must equal factor sum.');
        }

        $this->assertGreaterThan(5, max($scores) - min($scores), 'Scores must vary meaningfully.');

        $best = $recommendations[0];
        $this->assertSame(15.0, $best['vehicle_cbm_capacity'], 'Best fit should prefer the tightest suitable capacity.');
    }

    public function test_scenario_b_unavailable_driver_is_excluded(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $type = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'load_volume_m3' => 10,
            'status' => 'pending',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
        ]);

        $availableUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        $busyUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        $availableDriver = Driver::create([
            'user_id' => $availableUser->id,
            'full_name' => 'Available Driver',
            'license_no' => 'LIC-A',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $busyDriver = Driver::create([
            'user_id' => $busyUser->id,
            'full_name' => 'Busy Driver',
            'license_no' => 'LIC-B',
            'license_expiry' => now()->addYear(),
            'availability' => 'busy',
            'status' => 'available',
        ]);

        $vehicleA = Vehicle::create([
            'plate_no' => 'AA-1111',
            'type' => 'Dump Truck',
            'vehicle_type_id' => $type->id,
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $vehicleB = Vehicle::create([
            'plate_no' => 'BB-2222',
            'type' => 'Dump Truck',
            'vehicle_type_id' => $type->id,
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        DispatchAssignment::create([
            'job_order_id' => JobOrder::factory()->create(['created_by' => $this->dispatcher->id])->id,
            'driver_id' => $busyDriver->id,
            'vehicle_id' => $vehicleB->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => DeliveryStatus::ASSIGNED,
            'assigned_at' => now(),
        ]);

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $driverIds = collect($recommendations)->pluck('driver_id')->all();

        $this->assertContains($availableDriver->id, $driverIds);
        $this->assertNotContains($busyDriver->id, $driverIds);
    }

    public function test_scenario_c_vehicle_type_mismatch_is_rejected(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $requiredType = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);
        $otherType = VehicleType::create([
            'name' => 'Flatbed',
            'wheel_type' => '6 Wheeler',
            'min_cbm' => 5,
            'max_cbm' => 10,
            'status' => 'active',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $requiredType->id,
            'load_volume_m3' => 10,
            'status' => 'pending',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
        ]);

        $user = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        $driver = Driver::create([
            'user_id' => $user->id,
            'full_name' => 'Driver',
            'license_no' => 'LIC-C',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $wrongVehicle = Vehicle::create([
            'plate_no' => 'FB-9999',
            'type' => 'Flatbed',
            'vehicle_type_id' => $otherType->id,
            'cbm_capacity' => 12,
            'status' => 'available',
        ]);

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $this->assertFalse(collect($recommendations)->contains(fn ($rec) => $rec['vehicle_id'] === $wrongVehicle->id));
        $this->assertFalse(collect($recommendations)->contains(fn ($rec) => $rec['driver_id'] === $driver->id && $rec['vehicle_id'] === $wrongVehicle->id));
    }

    public function test_scenario_d_schedule_conflict_is_rejected(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $type = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);

        $windowStart = now()->addDay();
        $windowEnd = now()->addDay()->addHours(4);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'load_volume_m3' => 10,
            'status' => 'pending',
            'scheduled_start' => $windowStart,
            'scheduled_end' => $windowEnd,
        ]);

        $user = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        $driver = Driver::create([
            'user_id' => $user->id,
            'full_name' => 'Conflict Driver',
            'license_no' => 'LIC-D',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'CC-3333',
            'type' => 'Dump Truck',
            'vehicle_type_id' => $type->id,
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $existingJob = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'scheduled_start' => $windowStart->copy()->addHour(),
            'scheduled_end' => $windowEnd->copy()->subHour(),
        ]);

        DispatchAssignment::create([
            'job_order_id' => $existingJob->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => DeliveryStatus::ASSIGNED,
            'assigned_at' => now(),
        ]);

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $this->assertFalse(collect($recommendations)->contains(fn ($rec) => $rec['driver_id'] === $driver->id));
    }

    public function test_scenario_e_override_options_remain_after_recommendations(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $type = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'load_volume_m3' => 10,
            'status' => 'pending',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
        ]);

        $user = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        Driver::create([
            'user_id' => $user->id,
            'full_name' => 'Override Driver',
            'license_no' => 'LIC-E',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        Vehicle::create([
            'plate_no' => 'DD-4444',
            'type' => 'Dump Truck',
            'vehicle_type_id' => $type->id,
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $service = app(BestFitAssignmentService::class);
        $before = $service->recommend($jobOrder);
        $options = $service->overrideOptions($jobOrder);

        $this->assertNotEmpty($before);
        $this->assertNotEmpty($options['drivers']);
        $this->assertNotEmpty($options['vehicles']);

        DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $before[0]['driver_id'],
            'vehicle_id' => $before[0]['vehicle_id'],
            'assigned_by' => $this->dispatcher->id,
            'status' => DeliveryStatus::ASSIGNED,
            'assigned_at' => now(),
        ]);

        $after = $service->recommend($jobOrder);
        $this->assertNotSame(
            collect($before)->pluck('driver_id')->all(),
            collect($after)->pluck('driver_id')->all(),
            'Assigned driver should drop out of subsequent recommendations.',
        );
    }
}
