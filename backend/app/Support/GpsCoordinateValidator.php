<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

final class GpsCoordinateValidator
{
    public static function isUsable(mixed $latitude, mixed $longitude): bool
    {
        if (! is_numeric($latitude) || ! is_numeric($longitude)) {
            return false;
        }

        return self::validate((float) $latitude, (float) $longitude) === null;
    }

    public static function validate(?float $latitude, ?float $longitude): ?string
    {
        if ($latitude === null || $longitude === null) {
            return 'Latitude and longitude are required.';
        }

        $minLat = (float) config('gps.min_latitude', -90);
        $maxLat = (float) config('gps.max_latitude', 90);
        $minLng = (float) config('gps.min_longitude', -180);
        $maxLng = (float) config('gps.max_longitude', 180);

        if ($latitude < $minLat || $latitude > $maxLat) {
            return 'Latitude is out of valid range.';
        }

        if ($longitude < $minLng || $longitude > $maxLng) {
            return 'Longitude is out of valid range.';
        }

        if (config('gps.reject_near_zero', true)) {
            $threshold = (float) config('gps.near_zero_threshold', 0.0001);
            if (abs($latitude) < $threshold && abs($longitude) < $threshold) {
                return 'Invalid GPS coordinates (0,0).';
            }
        }

        if (config('gps.philippines_bounds.enabled', true)) {
            $bounds = config('gps.philippines_bounds');
            $phMinLat = (float) ($bounds['min_lat'] ?? 4.5);
            $phMaxLat = (float) ($bounds['max_lat'] ?? 21.5);
            $phMinLng = (float) ($bounds['min_lng'] ?? 116.0);
            $phMaxLng = (float) ($bounds['max_lng'] ?? 127.5);

            if ($latitude < $phMinLat || $latitude > $phMaxLat
                || $longitude < $phMinLng || $longitude > $phMaxLng) {
                return 'Coordinates are outside the Philippines service area.';
            }
        }

        return null;
    }

    /**
     * @return array{lat: float, lng: float}|null
     */
    public static function pair(mixed $latitude, mixed $longitude, string $context = 'coordinate'): ?array
    {
        if (! self::isUsable($latitude, $longitude)) {
            $reason = self::validate(
                is_numeric($latitude) ? (float) $latitude : null,
                is_numeric($longitude) ? (float) $longitude : null,
            ) ?? 'Invalid coordinates';

            Log::warning('Rejected invalid coordinates', [
                'context' => $context,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'reason' => $reason,
            ]);

            LocationPipelineLogger::log('coordinate_rejected', [
                'context' => $context,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'reason' => $reason,
            ]);

            return null;
        }

        return [
            'lat' => (float) $latitude,
            'lng' => (float) $longitude,
        ];
    }

    public static function areDuplicate(
        float $lat1,
        float $lng1,
        float $lat2,
        float $lng2,
        float $thresholdMeters = 15.0,
    ): bool {
        return self::distanceMeters($lat1, $lng1, $lat2, $lng2) <= $thresholdMeters;
    }

    public static function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $earthRadius * asin(min(1, sqrt($a)));
    }

    public static function impliedSpeedKmh(float $distanceMeters, float $elapsedSeconds): float
    {
        if ($elapsedSeconds <= 0) {
            return 0.0;
        }

        return ($distanceMeters / 1000) / ($elapsedSeconds / 3600);
    }
}
