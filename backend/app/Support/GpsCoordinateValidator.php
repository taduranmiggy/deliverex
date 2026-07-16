<?php

namespace App\Support;

final class GpsCoordinateValidator
{
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

        return null;
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
