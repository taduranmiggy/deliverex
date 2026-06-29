<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Resolves the driver's actual action time from offline-sync payloads.
 *
 * Accepts action_timestamp (mobile) or action_taken_at (alias). Malformed,
 * future, or unreasonably old values fall back to the server clock.
 */
class ActionTimestamp
{
    private const FUTURE_SKEW_MINUTES = 5;

    private const MAX_AGE_DAYS = 30;

    public static function resolveFromRequest(Request $request, ?Carbon $fallback = null): Carbon
    {
        $raw = $request->input('action_timestamp') ?? $request->input('action_taken_at');

        return self::resolve($raw, $fallback);
    }

    public static function resolve(mixed $raw, ?Carbon $fallback = null): Carbon
    {
        $fallback ??= now();

        if ($raw === null || $raw === '') {
            return $fallback->copy();
        }

        if (! is_string($raw)) {
            return $fallback->copy();
        }

        $trimmed = trim($raw);
        if ($trimmed === '' || ! self::looksLikeIso8601DateTime($trimmed)) {
            return $fallback->copy();
        }

        try {
            $parsed = Carbon::parse($trimmed);
        } catch (\Throwable) {
            return $fallback->copy();
        }

        $now = now();

        if ($parsed->gt($now->copy()->addMinutes(self::FUTURE_SKEW_MINUTES))) {
            return $fallback->copy();
        }

        if ($parsed->lt($now->copy()->subDays(self::MAX_AGE_DAYS))) {
            return $fallback->copy();
        }

        return $parsed;
    }

    private static function looksLikeIso8601DateTime(string $value): bool
    {
        return (bool) preg_match(
            '/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})?$/',
            $value,
        );
    }
}
