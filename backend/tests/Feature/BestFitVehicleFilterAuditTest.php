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
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BestFitVehicleFilterAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_adt_trucks_remain_eligible_for_thirty_cubic_meter_load(): void
    {
        $dispatcher = User::factory()->create(['email_verified_at' => now()]);
        $tenWheelerType = VehicleType::create([
            'name' => '10-Wheeler',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 13,
            'max_cbm' => 15,
            'status' => 'active',
        ]);
        $adtType = VehicleType::create([
            'name' => 'ADT',
            'wheel_type' => '12 Wheeler',
            'min_cbm' => 33,
            'max_cbm' => 39,
            'status' => 'active',
        ]);

        Driver::create([
            'user_id' => User::factory()->create()->id,
            'full_name' => 'Audit Driver',
            'license_no' => 'LIC-AUD',
            'license_expiry' => now()->addYear(),
            'status' => 'available',
        ]);

        Vehicle::create([
            'plate_no' => 'SMALL-01',
            'vehicle_type_id' => $tenWheelerType->id,
            'type' => '10-Wheeler',
            'cbm_capacity' => 14.63,
            'status' => 'available',
        ]);

        Vehicle::create([
            'plate_no' => 'NBC 5319',
            'vehicle_type_id' => $adtType->id,
            'type' => 'ADT',
            'capacity' => '33.81 m3',
            'cbm_capacity' => 33.81,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'preferred_vehicle_type_id' => $tenWheelerType->id,
            'load_volume_m3' => 30,
            'status' => 'pending',
        ]);

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $this->assertNotEmpty($recommendations, 'ADT trucks should remain eligible on capacity for a 30 m³ load.');

        $report = app(BestFitPipelineDiagnostic::class)->analyze($jobOrder);
        $this->assertGreaterThan(0, $report['summary']['eligible_vehicles']);
        $this->assertArrayHasKey('vehicle_audit', $report);

        $adtAudit = collect($report['vehicle_audit']['vehicles'])->firstWhere('plate_no', 'NBC 5319');
        $this->assertNotNull($adtAudit);
        $this->assertSame('ELIGIBLE', $adtAudit['final']);

        $capacityCheck = collect($adtAudit['checks'])->firstWhere('step', 'capacity');
        $this->assertTrue($capacityCheck['pass']);
        $this->assertStringContainsString('PASS', $capacityCheck['comparison']);
    }

    public function test_vehicle_audit_reports_capacity_failure_with_sources(): void
    {
        $dispatcher = User::factory()->create(['email_verified_at' => now()]);
        $type = VehicleType::create([
            'name' => '10-Wheeler',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 13,
            'max_cbm' => 15,
            'status' => 'active',
        ]);

        Vehicle::create([
            'plate_no' => 'SMALL-02',
            'vehicle_type_id' => $type->id,
            'type' => '10-Wheeler',
            'cbm_capacity' => 13.99,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'load_volume_m3' => 30,
            'status' => 'pending',
        ]);

        $report = app(BestFitPipelineDiagnostic::class)->analyze($jobOrder);
        $audit = collect($report['vehicle_audit']['vehicles'])->firstWhere('plate_no', 'SMALL-02');

        $this->assertSame('REJECTED', $audit['final']);
        $this->assertSame('capacity_insufficient', $audit['hard_rejection']);

        $capacityCheck = collect($audit['checks'])->firstWhere('step', 'capacity');
        $this->assertFalse($capacityCheck['pass']);
        $this->assertSame(13.99, $capacityCheck['actual']);
        $this->assertSame(30.0, $capacityCheck['required']);
    }

    public function test_active_assignment_is_reported_as_hard_rejection(): void
    {
        $dispatcher = User::factory()->create(['email_verified_at' => now()]);
        $driverRole = Role::create(['name' => 'driver']);
        $driverUser = User::factory()->create(['role_id' => $driverRole->id]);
        $type = VehicleType::create([
            'name' => 'ADT',
            'wheel_type' => '12 Wheeler',
            'min_cbm' => 33,
            'max_cbm' => 39,
            'status' => 'active',
        ]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'full_name' => 'Busy Driver',
            'license_no' => 'LIC-BUSY',
            'license_expiry' => now()->addYear(),
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'BUSY-01',
            'vehicle_type_id' => $type->id,
            'type' => 'ADT',
            'cbm_capacity' => 39.1,
            'status' => 'available',
        ]);

        $existingJob = JobOrder::factory()->create(['created_by' => $dispatcher->id]);
        DispatchAssignment::create([
            'job_order_id' => $existingJob->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => DeliveryStatus::ASSIGNED,
            'assigned_at' => now(),
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'preferred_vehicle_type_id' => $type->id,
            'load_volume_m3' => 30,
            'status' => 'pending',
        ]);

        $audit = collect(app(BestFitPipelineDiagnostic::class)->analyze($jobOrder)['vehicle_audit']['vehicles'])
            ->firstWhere('plate_no', 'BUSY-01');

        $this->assertSame('REJECTED', $audit['final']);
        $this->assertSame('active_assignment', $audit['hard_rejection']);
    }
}
