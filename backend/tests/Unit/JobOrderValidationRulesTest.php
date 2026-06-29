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
            'dropoff_street' => 'Lot 12, Phase 2 Construction Site',
            'dropoff_barangay' => 'Batasan Hills',
            'dropoff_city' => 'Quezon City',
            'dropoff_province' => 'Metro Manila',
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

    public function test_rejects_delivery_window_shorter_than_minimum(): void
    {
        $this->expectException(ValidationException::class);

        $start = now()->addHour();

        JobOrderScheduleValidator::validatePayload([
            'scheduled_start' => $start->toIso8601String(),
            'scheduled_end' => $start->copy()->addMinutes(15)->toIso8601String(),
        ]);
    }

    public function test_accepts_delivery_window_at_minimum(): void
    {
        $start = Carbon::now()->addHour();
        $min = JobOrderScheduleValidator::minDeliveryWindowMinutes();

        JobOrderScheduleValidator::validatePayload([
            'scheduled_start' => $start->toIso8601String(),
            'scheduled_end' => $start->copy()->addMinutes($min)->toIso8601String(),
        ]);

        $this->assertTrue(true);
    }
}
