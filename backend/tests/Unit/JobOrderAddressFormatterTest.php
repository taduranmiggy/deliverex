<?php

namespace Tests\Unit;

use App\Models\JobOrder;
use App\Support\JobOrderAddressFormatter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JobOrderAddressFormatterTest extends TestCase
{
    use RefreshDatabase;

    public function test_single_line_input_maps_to_street_only_without_duplication(): void
    {
        $parsed = JobOrderAddressFormatter::parseLine('FEU Institute of Technology');

        $this->assertSame('FEU Institute of Technology', $parsed['street']);
        $this->assertSame('', $parsed['barangay']);
        $this->assertSame('', $parsed['city']);
        $this->assertSame('', $parsed['province']);
        $this->assertSame(
            'FEU Institute of Technology',
            JobOrderAddressFormatter::formatParts(array_values($parsed)),
        );
    }

    public function test_three_part_line_preserves_distinct_segments_once(): void
    {
        $line = 'FEU Institute of Technology, Sampaloc, Manila';
        $parsed = JobOrderAddressFormatter::parseLine($line);

        $this->assertSame('FEU Institute of Technology', $parsed['street']);
        $this->assertSame('Sampaloc', $parsed['barangay']);
        $this->assertSame('Manila', $parsed['city']);
        $this->assertSame(
            $line,
            JobOrderAddressFormatter::formatParts([
                $parsed['street'],
                $parsed['barangay'],
                $parsed['city'],
                $parsed['province'],
            ]),
        );
    }

    public function test_format_parts_removes_repeated_structured_values(): void
    {
        $formatted = JobOrderAddressFormatter::formatParts([
            'FEU Institute of Technology, Sampaloc, Manila',
            'FEU Institute of Technology, Sampaloc, Manila',
            'FEU Institute of Technology, Sampaloc, Manila',
            'FEU Institute of Technology, Sampaloc, Manila',
        ]);

        $this->assertSame('FEU Institute of Technology, Sampaloc, Manila', $formatted);
    }

    public function test_repair_structured_collapses_identical_columns(): void
    {
        $repaired = JobOrderAddressFormatter::repairStructured(
            'FEU Institute of Technology',
            'FEU Institute of Technology',
            'FEU Institute of Technology',
            'FEU Institute of Technology',
            'FEU Institute of Technology, FEU Institute of Technology, FEU Institute of Technology, FEU Institute of Technology',
        );

        $this->assertSame('FEU Institute of Technology', $repaired['street']);
        $this->assertNull($repaired['barangay']);
        $this->assertNull($repaired['city']);
        $this->assertNull($repaired['province']);
        $this->assertSame('FEU Institute of Technology', $repaired['location']);
    }

    public function test_job_order_display_accessor_deduplicates_structured_fields(): void
    {
        $user = \App\Models\User::factory()->create(['email_verified_at' => now()]);
        $job = JobOrder::factory()->create([
            'created_by' => $user->id,
            'dropoff_street' => 'Padre Paredes St',
            'dropoff_barangay' => 'Padre Paredes St',
            'dropoff_city' => 'Padre Paredes St',
            'dropoff_province' => 'Padre Paredes St',
            'dropoff_location' => 'Padre Paredes St, Padre Paredes St, Padre Paredes St, Padre Paredes St',
        ]);

        $this->assertSame('Padre Paredes St', $job->display_dropoff);
    }
}
