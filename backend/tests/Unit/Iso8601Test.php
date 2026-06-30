<?php

namespace Tests\Unit;

use App\Support\Iso8601;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class Iso8601Test extends TestCase
{
    public function test_from_null_returns_null(): void
    {
        $this->assertNull(Iso8601::from(null));
        $this->assertNull(Iso8601::from(''));
    }

    public function test_from_carbon_returns_iso_string(): void
    {
        $value = Iso8601::from(Carbon::parse('2026-06-30 10:15:00'));

        $this->assertIsString($value);
        $this->assertStringContainsString('2026-06-30', $value);
    }

    public function test_from_string_returns_iso_string(): void
    {
        $value = Iso8601::from('2026-06-30 10:15:00');

        $this->assertIsString($value);
        $this->assertStringContainsString('2026-06-30', $value);
    }
}
