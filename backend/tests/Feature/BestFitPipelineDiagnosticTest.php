<?php

namespace Tests\Feature;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use App\Services\Assignment\BestFitAssignmentService;
use App\Services\Assignment\BestFitPipelineDiagnostic;
use App\Services\Fleet\AssignmentResourceSyncService;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BestFitPipelineDiagnosticTest extends TestCase
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

    public function test_legacy_dispatched_assignment_blocks_driver_until_repaired(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'full_name' => 'Legacy Driver',
            'license_no' => 'LIC-LEG-001',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'LEG-001',
            'type' => 'Dump Truck',
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $completedJob = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'status' => 'completed',
        ]);

        DispatchAssignment::create([
            'job_order_id' => $completedJob->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => 'dispatched',
            'assigned_at' => now()->subDay(),
            'completed_at' => now()->subHours(2),
        ]);

        $pendingJob = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'vehicle_type_required' => 'Dump Truck',
            'load_volume_m3' => 10,
            'status' => 'pending',
        ]);

        $service = app(BestFitAssignmentService::class);
        $this->assertSame([], $service->recommend($pendingJob));

        app(AssignmentResourceSyncService::class)->repairStaleBlockingAssignments('test');

        $recommendations = $service->recommend($pendingJob);
        $this->assertNotEmpty($recommendations);
        $this->assertSame($driver->id, $recommendations[0]['driver_id']);
    }

    public function test_vehicle_type_matches_by_preferred_vehicle_type_id(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        $requiredType = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);

        Driver::create([
            'user_id' => $driverUser->id,
            'full_name' => 'Type Match Driver',
            'license_no' => 'LIC-TYPE-001',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'TYPE-001',
            'type' => 'Legacy Label Mismatch',
            'vehicle_type_id' => $requiredType->id,
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $requiredType->id,
            'vehicle_type_required' => 'Dump Truck',
            'load_volume_m3' => 10,
            'status' => 'pending',
        ]);

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);

        $this->assertNotEmpty($recommendations);
        $this->assertSame($vehicle->id, $recommendations[0]['vehicle_id']);
    }

    public function test_diagnostics_report_license_incomplete_removals(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        Driver::create([
            'user_id' => $driverUser->id,
            'full_name' => 'No Expiry Driver',
            'license_no' => 'LIC-NO-EXP',
            'license_expiry' => null,
            'availability' => 'available',
            'status' => 'available',
        ]);

        Vehicle::create([
            'plate_no' => 'VEH-001',
            'type' => 'Dump Truck',
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'vehicle_type_required' => 'Dump Truck',
            'load_volume_m3' => 10,
            'status' => 'pending',
        ]);

        $report = app(BestFitPipelineDiagnostic::class)->analyze($jobOrder);

        $this->assertSame(0, $report['summary']['recommendation_count']);
        $this->assertSame('all_drivers_filtered', $report['bottleneck']);
        $this->assertCount(1, $report['drivers']['removed']['license_incomplete']);
        $this->assertSame('No Expiry Driver', $report['drivers']['removed']['license_incomplete'][0]['name']);
    }

    public function test_recommendations_are_not_capped_at_ten_drivers(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $type = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'FLEET-SHARED',
            'type' => 'Dump Truck',
            'vehicle_type_id' => $type->id,
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        for ($i = 1; $i <= 12; $i++) {
            $user = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
            Driver::create([
                'user_id' => $user->id,
                'full_name' => "Eligible Driver {$i}",
                'license_no' => "LIC-FLEET-{$i}",
                'license_expiry' => now()->addYear(),
                'availability' => 'available',
                'status' => 'available',
            ]);
        }

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'vehicle_type_required' => 'Dump Truck',
            'load_volume_m3' => 10,
            'status' => 'pending',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
        ]);

        $service = app(BestFitAssignmentService::class);
        $recommendations = $service->recommend($jobOrder);
        $uniqueDrivers = count(array_unique(array_column($recommendations, 'driver_id')));

        $this->assertGreaterThan(10, count($recommendations));
        $this->assertSame(12, $uniqueDrivers);

        $override = $service->overrideOptions($jobOrder);
        $this->assertCount(12, $override['drivers']);
        $this->assertSame($vehicle->id, $recommendations[0]['vehicle_id']);
    }

    public function test_best_fit_api_includes_eligibility_meta(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $type = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 20,
            'status' => 'active',
        ]);

        $user = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        Driver::create([
            'user_id' => $user->id,
            'full_name' => 'Meta Driver',
            'license_no' => 'LIC-META-1',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        Vehicle::create([
            'plate_no' => 'META-001',
            'type' => 'Dump Truck',
            'vehicle_type_id' => $type->id,
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'vehicle_type_required' => 'Dump Truck',
            'load_volume_m3' => 10,
            'status' => 'pending',
        ]);

        $this->apiAs($this->dispatcher)
            ->getJson("/api/dispatch/best-fit/{$jobOrder->id}")
            ->assertOk()
            ->assertJsonPath('meta.eligible_drivers', 1)
            ->assertJsonPath('meta.override_driver_count', 1)
            ->assertJsonPath('meta.recommendation_count', 1);
    }

    public function test_best_fit_api_includes_diagnostics_when_empty(): void
    {
        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'vehicle_type_required' => 'Dump Truck',
            'status' => 'pending',
        ]);

        $this->apiAs($this->dispatcher)
            ->getJson("/api/dispatch/best-fit/{$jobOrder->id}")
            ->assertOk()
            ->assertJsonPath('recommendations', [])
            ->assertJsonStructure([
                'diagnostics' => [
                    'summary',
                    'drivers' => ['total', 'eligible_count', 'removed_counts', 'removed'],
                    'vehicles' => ['total', 'eligible_count', 'removed_counts', 'removed'],
                    'bottleneck',
                ],
            ]);
    }

    public function test_override_options_include_drivers_without_license_and_mismatched_vehicles(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $requiredType = VehicleType::create([
            'name' => 'Mini Dump',
            'wheel_type' => '6 Wheeler',
            'min_cbm' => 30,
            'max_cbm' => 40,
            'status' => 'active',
        ]);
        $otherType = VehicleType::create([
            'name' => '10 Wheeler',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 10,
            'max_cbm' => 15,
            'status' => 'active',
        ]);

        $licensedUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        Driver::create([
            'user_id' => $licensedUser->id,
            'full_name' => 'Licensed Driver',
            'license_no' => 'LIC-OK-1',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $unlicensedUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);
        Driver::create([
            'user_id' => $unlicensedUser->id,
            'full_name' => 'Unlicensed Driver',
            'license_no' => null,
            'availability' => 'available',
            'status' => 'available',
        ]);

        Vehicle::create([
            'plate_no' => 'MINI-35',
            'type' => 'Mini Dump',
            'vehicle_type_id' => $requiredType->id,
            'cbm_capacity' => 35,
            'status' => 'available',
        ]);

        Vehicle::create([
            'plate_no' => 'BIG-10',
            'type' => '10 Wheeler',
            'vehicle_type_id' => $otherType->id,
            'cbm_capacity' => 12,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'preferred_vehicle_type_id' => $requiredType->id,
            'vehicle_type_required' => 'Mini Dump',
            'load_volume_m3' => 35,
            'status' => 'pending',
        ]);

        $options = app(BestFitAssignmentService::class)->overrideOptions($jobOrder);

        $this->assertCount(2, $options['drivers']);
        $this->assertCount(2, $options['vehicles']);

        $unlicensed = collect($options['drivers'])->firstWhere('name', 'Unlicensed Driver');
        $this->assertTrue($unlicensed['override_selectable']);
        $this->assertFalse($unlicensed['eligible']);

        $mismatchVehicle = collect($options['vehicles'])->firstWhere('plate_no', 'BIG-10');
        $this->assertTrue($mismatchVehicle['override_selectable']);
        $this->assertFalse($mismatchVehicle['meets_type']);
        $this->assertFalse($mismatchVehicle['meets_capacity']);

        $this->assertCount(4, $options['pairings']);
    }
}
