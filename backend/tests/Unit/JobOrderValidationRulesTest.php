<?php

namespace Tests\Unit;

use App\Support\JobOrderAddressValidator;
use App\Support\JobOrderScheduleValidator;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class JobOrderValidationRulesTest extends TestCase
{
    public function test_rejects_vague_dropoff_address(): void
    {
        $this->expectException(ValidationException::class);

        JobOrderAddressValidator::validatePayload([
            'dropoff_street' => 'site',
            'dropoff_barangay' => 'San Roque',
            'dropoff_city' => 'Antipolo',
            'dropoff_province' => 'Rizal',
        ]);
    }

    public function test_accepts_complete_dropoff_address(): void
    {
        JobOrderAddressValidator::validatePayload([
            'quarry_id' => 1,
            'dropoff_street' => 'Lot 12, Phase 2 Construction Site',
            'dropoff_barangay' => 'Batasan Hills',
            'dropoff_city' => 'Quezon City',
            'dropoff_province' => 'Metro Manila',
        ]);

        $this->assertTrue(true);
    }

    public function test_accepts_single_line_dropoff_when_street_is_specific(): void
    {
        JobOrderAddressValidator::validatePayload([
            'quarry_id' => 1,
            'dropoff_street' => 'FEU Institute of Technology',
            'dropoff_location' => 'FEU Institute of Technology',
        ]);

        $this->assertTrue(true);
    }

    public function test_skips_pickup_structured_fields_when_quarry_selected(): void
    {
        JobOrderAddressValidator::validatePayload([
            'quarry_id' => 1,
            'dropoff_street' => 'Block 5, Warehouse Row',
            'dropoff_barangay' => 'San Roque',
            'dropoff_city' => 'Antipolo',
            'dropoff_province' => 'Rizal',
        ]);

        $this->assertTrue(true);
    }

    public function test_accepts_scheduled_start_without_end(): void
    {
        JobOrderScheduleValidator::validatePayload([
            'scheduled_start' => now()->addHour()->toIso8601String(),
        ]);

        $this->assertTrue(true);
    }

    public function test_accepts_legacy_end_time_after_start_without_minimum_window(): void
    {
        $start = Carbon::now()->addHour();

        JobOrderScheduleValidator::validatePayload([
            'scheduled_start' => $start->toIso8601String(),
            'scheduled_end' => $start->copy()->addMinutes(15)->toIso8601String(),
        ]);

        $this->assertTrue(true);
    }
}
