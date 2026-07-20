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

    public function test_vehicle_type_match_awards_full_cargo_score_for_exact_type_match(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('10 Wheeler', '10 Wheeler');

        $factor = $this->factorFor($jobOrder, $vehicle, 'cargo_compatibility');

        $this->assertTrue($factor['matched']);
        $this->assertGreaterThanOrEqual(10, $factor['contribution']);
        $this->assertSame(15, $factor['max']);
        $this->assertStringContainsString('matches', $factor['detail']);
    }

    public function test_vehicle_type_match_is_case_and_whitespace_insensitive(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('Mini Dump', '  mini dump  ');

        $factor = $this->factorFor($jobOrder, $vehicle, 'cargo_compatibility');

        $this->assertTrue($factor['matched']);
        $this->assertGreaterThanOrEqual(10, $factor['contribution']);
    }

    public function test_vehicle_type_mismatch_is_scored_not_rejected(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('Dump Truck', '10 Wheeler');

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $match = collect($recommendations)->firstWhere('vehicle_id', $vehicle->id);

        $this->assertNotNull($match, 'Mismatched vehicle type should be scored, not rejected.');
        $this->assertNotEmpty($match['warnings']);
        $cargo = collect($match['factors'])->firstWhere('key', 'cargo_compatibility');
        $this->assertIsArray($cargo);
        $this->assertFalse($cargo['matched']);
    }

    public function test_recommendations_include_distance_factor(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('10 Wheeler', '10 Wheeler');

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $match = collect($recommendations)->firstWhere('vehicle_id', $vehicle->id);

        $this->assertNotNull($match);
        $this->assertSame(100, $match['score_max']);
        $this->assertTrue(collect($match['factors'])->contains(fn ($f) => ($f['key'] ?? null) === 'distance_to_pickup'));
    }

    public function test_factor_contributions_sum_to_reported_score(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('10 Wheeler', '10 Wheeler');

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $match = collect($recommendations)->firstWhere('vehicle_id', $vehicle->id);

        $this->assertNotNull($match);
        $sum = collect($match['factors'])->sum('contribution');
        $this->assertSame($match['score'], $sum);
    }

    public function test_vehicle_type_matches_by_id_when_free_text_labels_differ(): void
    {
        [$jobOrder, $vehicle] = $this->seedPair('Dump Truck', 'Legacy Mismatch Label', matchById: true);

        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $match = collect($recommendations)->firstWhere('vehicle_id', $vehicle->id);

        $this->assertNotNull($match, 'Vehicle should match via preferred_vehicle_type_id.');
    }

    /**
     * @return array{0: JobOrder, 1: Vehicle}
     */
    private function seedPair(string $requiredTypeName, string $vehicleTypeName, bool $matchById = false): array
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

        Driver::create([
            'user_id' => $user->id,
            'full_name' => 'Best Fit Driver',
            'license_no' => 'LIC-BF-001',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'BF-001',
            'type' => $vehicleTypeName,
            'vehicle_type_id' => $matchById ? $requiredType->id : $vehicleType->id,
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

        return [$jobOrder, $vehicle];
    }

    /**
     * @return array{matched: bool, contribution: int, max: int, detail: string}
     */
    private function factorFor(JobOrder $jobOrder, Vehicle $vehicle, string $key): array
    {
        $vehicle->load('vehicleType');
        $recommendations = app(BestFitAssignmentService::class)->recommend($jobOrder);
        $match = collect($recommendations)->firstWhere('vehicle_id', $vehicle->id);

        $this->assertNotNull($match, 'Expected a recommendation for the seeded vehicle.');

        $factor = collect($match['factors'])->firstWhere('key', $key);
        $this->assertIsArray($factor);

        return $factor;
    }
}
