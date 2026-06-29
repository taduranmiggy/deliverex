<?php

namespace Tests\Unit;

use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use App\Services\Assignment\BestFitAssignmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BestFitVehicleTypeMatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_vehicle_type_match_awards_full_score_when_job_volume_is_within_cbm_range(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair(minCbm: 14, maxCbm: 16, jobVolume: 14.8);

        $factor = $this->vehicleTypeFactor($jobOrder, $vehicle);

        $this->assertTrue($factor['matched']);
        $this->assertSame(25, $factor['contribution']);
        $this->assertSame(25, $factor['max']);
        $this->assertStringContainsString('falls within the configured CBM range', $factor['detail']);
    }

    public function test_vehicle_type_match_awards_zero_when_job_volume_exceeds_cbm_range(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair(minCbm: 2, maxCbm: 4, jobVolume: 14.8);

        $factor = $this->vehicleTypeFactor($jobOrder, $vehicle);

        $this->assertFalse($factor['matched']);
        $this->assertSame(0, $factor['contribution']);
        $this->assertSame(25, $factor['max']);
        $this->assertStringContainsString('exceeds the configured CBM range', $factor['detail']);
    }

    /**
     * @return array{0: JobOrder, 1: Vehicle}
     */
    private function seedPair(float $minCbm, float $maxCbm, float $jobVolume): array
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $vehicleType = VehicleType::create([
            'name' => 'Dump Truck',
            'wheel_type' => '10 Wheeler',
            'min_cbm' => $minCbm,
            'max_cbm' => $maxCbm,
            'status' => 'active',
        ]);

        $driver = Driver::create([
            'user_id' => $user->id,
            'license_no' => 'LIC-BF-001',
            'availability' => 'available',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'BF-001',
            'type' => 'Dump Truck',
            'vehicle_type_id' => $vehicleType->id,
            'capacity' => '16 m3',
            'cbm_capacity' => 16,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $user->id,
            'load_volume_m3' => $jobVolume,
            'status' => 'pending',
        ]);

        $this->assertNotNull($driver);
        $this->assertNotNull($vehicle);

        return [$jobOrder, $vehicle];
    }

    /**
     * @return array{matched: bool, contribution: int, max: int, detail: string}
     */
    private function vehicleTypeFactor(JobOrder $jobOrder, Vehicle $vehicle): array
    {
        $vehicle->load('vehicleType');
        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $match = collect($recommendations)->firstWhere('vehicle_id', $vehicle->id);

        $this->assertNotNull($match, 'Expected a recommendation for the seeded vehicle.');

        $factor = collect($match['factors'])->firstWhere('key', 'vehicle_type_match');
        $this->assertIsArray($factor);

        return $factor;
    }
}
