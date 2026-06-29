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

    public function test_vehicle_type_match_awards_full_score_for_exact_type_match(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('10 Wheeler', '10 Wheeler');

        $factor = $this->vehicleTypeFactor($jobOrder, $vehicle);

        $this->assertTrue($factor['matched']);
        $this->assertSame(20, $factor['contribution']);
        $this->assertSame(20, $factor['max']);
        $this->assertStringContainsString('exactly matches', $factor['detail']);
    }

    public function test_vehicle_type_match_is_case_and_whitespace_insensitive(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('Mini Dump', '  mini dump  ');

        $factor = $this->vehicleTypeFactor($jobOrder, $vehicle);

        $this->assertTrue($factor['matched']);
        $this->assertSame(20, $factor['contribution']);
    }

    public function test_vehicle_type_match_awards_zero_for_mismatched_types(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('Dump Truck', '10 Wheeler');

        $factor = $this->vehicleTypeFactor($jobOrder, $vehicle);

        $this->assertFalse($factor['matched']);
        $this->assertSame(0, $factor['contribution']);
        $this->assertSame(20, $factor['max']);
        $this->assertStringContainsString('does not match', $factor['detail']);
    }

    public function test_recommendations_do_not_include_distance_factor(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('10 Wheeler', '10 Wheeler');

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $match = collect($recommendations)->firstWhere('vehicle_id', $vehicle->id);

        $this->assertNotNull($match);
        $this->assertSame(100, $match['score_max']);
        $this->assertFalse(collect($match['factors'])->contains(fn ($f) => ($f['key'] ?? null) === 'distance'));
    }

    /**
     * @return array{0: JobOrder, 1: Vehicle}
     */
    private function seedPair(string $requiredTypeName, string $vehicleTypeName): array
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $requiredType = VehicleType::create([
            'name' => $requiredTypeName,
            'wheel_type' => '6 Wheeler',
            'min_cbm' => 2,
            'max_cbm' => 4,
            'status' => 'active',
        ]);

        $vehicleType = VehicleType::create([
            'name' => $vehicleTypeName,
            'wheel_type' => '10 Wheeler',
            'min_cbm' => 13,
            'max_cbm' => 15,
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
            'type' => $vehicleTypeName,
            'vehicle_type_id' => $vehicleType->id,
            'capacity' => '15 m3',
            'cbm_capacity' => 15,
            'status' => 'available',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $user->id,
            'preferred_vehicle_type_id' => $requiredType->id,
            'vehicle_type_required' => $requiredTypeName,
            'load_volume_m3' => 14.8,
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
