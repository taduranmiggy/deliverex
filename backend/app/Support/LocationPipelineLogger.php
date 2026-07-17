<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Temporary debug logging for the location pipeline.
 * Enable with GPS_DEBUG_PIPELINE=true in .env
 */
final class LocationPipelineLogger
{
    /** @param  array<string, mixed>  $context */
    public static function log(string $stage, array $context = []): void
    {
        if (! config('gps.debug_pipeline', false)) {
            return;
        }

        Log::info('[location-pipeline] '.$stage, $context);
    }
}
