<?php

namespace App\Support;

use App\Models\GeocodingTrace;

final class LocationTraceRecorder
{
    public static function apiDelivered(?string $traceId, ?array $point): void
    {
        if (! $traceId || ! isset($point['lat'], $point['lng'])) {
            return;
        }

        $trace = GeocodingTrace::query()->find($traceId);
        if (! $trace) {
            return;
        }

        $mismatch = $trace->stored_latitude !== null
            && $trace->stored_longitude !== null
            && GpsCoordinateValidator::distanceMeters(
                $trace->stored_latitude,
                $trace->stored_longitude,
                (float) $point['lat'],
                (float) $point['lng'],
            ) > 0.05;

        $trace->update([
            'api_latitude' => $point['lat'],
            'api_longitude' => $point['lng'],
            'status' => $mismatch ? 'coordinate_mismatch' : ($trace->rendered_at ? 'rendered' : 'api_delivered'),
            'error_message' => $mismatch
                ? 'Coordinates returned by the API differ from the stored database pair.'
                : $trace->error_message,
        ]);
    }
}
