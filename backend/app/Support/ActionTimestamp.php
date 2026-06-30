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
        return self::resolveFromRequestWithMeta($request, $fallback)['actionAt'];
    }

    /**
     * @return array{actionAt: Carbon, fromClient: bool}
     */
    public static function resolveFromRequestWithMeta(Request $request, ?Carbon $fallback = null): array
    {
        $raw = $request->input('action_timestamp') ?? $request->input('action_taken_at');

        return self::resolveWithMeta($raw, $fallback);
    }

    public static function resolve(mixed $raw, ?Carbon $fallback = null): Carbon
    {
        return self::resolveWithMeta($raw, $fallback)['actionAt'];
    }

    /**
     * @return array{actionAt: Carbon, fromClient: bool}
     */
    public static function resolveWithMeta(mixed $raw, ?Carbon $fallback = null): array
    {
        $fallback ??= now();
        $parsed = self::tryParseClientTimestamp($raw);

        if ($parsed !== null) {
            return [
                'actionAt' => $parsed,
                'fromClient' => true,
            ];
        }

        return [
            'actionAt' => $fallback->copy(),
            'fromClient' => false,
        ];
    }

    private static function tryParseClientTimestamp(mixed $raw): ?Carbon
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        if (! is_string($raw)) {
            return null;
        }

        $trimmed = trim($raw);
        if ($trimmed === '' || ! self::looksLikeIso8601DateTime($trimmed)) {
            return null;
        }

        try {
            $parsed = Carbon::parse($trimmed);
        } catch (\Throwable) {
            return null;
        }

        $now = now();

        if ($parsed->gt($now->copy()->addMinutes(self::FUTURE_SKEW_MINUTES))) {
            return null;
        }

        if ($parsed->lt($now->copy()->subDays(self::MAX_AGE_DAYS))) {
            return null;
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
