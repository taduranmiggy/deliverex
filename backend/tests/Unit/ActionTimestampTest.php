<?php

namespace Tests\Unit;

use App\Support\ActionTimestamp;
use Carbon\Carbon;
use Tests\TestCase;

class ActionTimestampTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_resolves_valid_iso8601_timestamp(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        $resolved = ActionTimestamp::resolve('2026-06-29T10:15:00.000Z');

        $this->assertSame('2026-06-29 10:15:00', $resolved->format('Y-m-d H:i:s'));
    }

    public function test_accepts_action_taken_at_alias(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        $request = request()->merge(['action_taken_at' => '2026-06-29T10:12:00Z']);
        $resolved = ActionTimestamp::resolveFromRequest($request);

        $this->assertSame('2026-06-29 10:12:00', $resolved->format('Y-m-d H:i:s'));
    }

    public function test_falls_back_for_malformed_timestamp(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        $resolved = ActionTimestamp::resolve('not-a-real-timestamp');

        $this->assertSame('2026-06-29 10:30:00', $resolved->format('Y-m-d H:i:s'));
    }

    public function test_falls_back_for_future_timestamp_beyond_skew(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        $resolved = ActionTimestamp::resolve('2026-06-29T10:40:00.000Z');

        $this->assertSame('2026-06-29 10:30:00', $resolved->format('Y-m-d H:i:s'));
    }

    public function test_falls_back_for_unreasonably_old_timestamp(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        $resolved = ActionTimestamp::resolve('2026-01-01T08:00:00.000Z');

        $this->assertSame('2026-06-29 10:30:00', $resolved->format('Y-m-d H:i:s'));
    }

    public function test_falls_back_when_timestamp_missing(): void
    {
        Carbon::setTestNow('2026-06-29 10:30:00');

        $resolved = ActionTimestamp::resolve(null);

        $this->assertSame('2026-06-29 10:30:00', $resolved->format('Y-m-d H:i:s'));
    }
}
