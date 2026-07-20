<?php

namespace Tests\Unit;

use App\Models\Driver;
use App\Support\PhilippineDriverLicenseGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhilippineDriverLicenseGeneratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_lto_style_license_number(): void
    {
        $license = PhilippineDriverLicenseGenerator::generateForDriver(42);

        $this->assertTrue(PhilippineDriverLicenseGenerator::isPhilippineFormat($license));
        $this->assertMatchesRegularExpression('/^N\d{2}-\d{2}-\d{6}$/', $license);
    }

    public function test_generated_numbers_are_unique_when_reserved_list_grows(): void
    {
        $first = PhilippineDriverLicenseGenerator::generateForDriver(7);
        $second = PhilippineDriverLicenseGenerator::generateForDriver(7, [$first]);

        $this->assertNotSame($first, $second);
    }

    public function test_placeholder_detection(): void
    {
        $this->assertTrue(PhilippineDriverLicenseGenerator::isMissingOrPlaceholder(null));
        $this->assertTrue(PhilippineDriverLicenseGenerator::isMissingOrPlaceholder(''));
        $this->assertTrue(PhilippineDriverLicenseGenerator::isMissingOrPlaceholder('PENDING-12'));
        $this->assertFalse(PhilippineDriverLicenseGenerator::isMissingOrPlaceholder('N03-24-014123'));
    }

    public function test_backfill_skips_drivers_with_existing_license(): void
    {
        Driver::create([
            'full_name' => 'Has License',
            'license_no' => 'N01-20-999999',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        Driver::create([
            'full_name' => 'Needs License',
            'license_no' => null,
            'availability' => 'available',
            'status' => 'available',
        ]);

        $result = app(\App\Services\Driver\DriverLicenseBackfillService::class)->backfillMissingLicenses();

        $this->assertSame(1, $result['updated']);
        $this->assertSame(1, $result['skipped']);

        $filled = Driver::query()->where('full_name', 'Needs License')->first();
        $this->assertTrue(PhilippineDriverLicenseGenerator::isPhilippineFormat($filled->license_no));
        $this->assertNotNull($filled->license_expiry);
    }
}
