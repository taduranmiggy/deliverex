<?php

namespace Tests\Unit;

use App\Models\JobOrder;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use App\Support\VehicleTypeMatcher;
use App\Support\VehicleVolumeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleVolumeResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_parses_capacity_label_when_numeric_columns_missing(): void
    {
        $vehicle = Vehicle::create([
            'plate_no' => 'NBC 5319',
            'type' => 'ADT',
            'capacity' => '39.1 m3',
            'status' => 'available',
        ]);

        $resolved = VehicleVolumeResolver::resolve($vehicle);

        $this->assertSame(39.1, $resolved['value_m3']);
        $this->assertSame('capacity_label', $resolved['primary_source']);
    }

    public function test_prefers_cbm_capacity_over_label(): void
    {
        $vehicle = Vehicle::create([
            'plate_no' => 'CAP-001',
            'type' => 'ADT',
            'capacity' => '39.1 m3',
            'cbm_capacity' => 33.81,
            'status' => 'available',
        ]);

        $resolved = VehicleVolumeResolver::resolve($vehicle);

        $this->assertSame(33.81, $resolved['value_m3']);
        $this->assertSame('cbm_capacity', $resolved['primary_source']);
    }

    public function test_meets_required_uses_numeric_comparison_not_string_order(): void
    {
        $vehicle = Vehicle::create([
            'plate_no' => 'CAP-002',
            'type' => 'ADT',
            'cbm_capacity' => 39.1,
            'status' => 'available',
        ]);

        $report = VehicleVolumeResolver::meetsRequired($vehicle, 30.0);

        $this->assertTrue($report['pass']);
        $this->assertStringContainsString('PASS', $report['comparison']);
    }

    public function test_rejects_when_required_exceeds_capacity(): void
    {
        $vehicle = Vehicle::create([
            'plate_no' => 'CAP-003',
            'type' => '10-Wheeler',
            'cbm_capacity' => 14.63,
            'status' => 'available',
        ]);

        $report = VehicleVolumeResolver::meetsRequired($vehicle, 30.0);

        $this->assertFalse($report['pass']);
        $this->assertStringContainsString('FAIL', $report['comparison']);
    }

    public function test_wheel_type_aliases_match(): void
    {
        $requiredType = VehicleType::create([
            'name' => '10-Wheeler',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 13,
            'max_cbm' => 15,
            'status' => 'active',
        ]);

        $vehicleType = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 14,
            'max_cbm' => 14,
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'TEN-001',
            'vehicle_type_id' => $vehicleType->id,
            'type' => 'Dump Truck',
            'cbm_capacity' => 14,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => User::factory()->create()->id,
            'preferred_vehicle_type_id' => $requiredType->id,
        ]);

        $report = VehicleTypeMatcher::evaluate($vehicle, $jobOrder);

        $this->assertTrue($report['matched'], $report['comparison']);
    }
}
