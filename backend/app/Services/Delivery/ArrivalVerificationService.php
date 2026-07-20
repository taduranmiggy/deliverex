<?php

namespace App\Services\Delivery;

use App\Models\JobOrder;
use App\Support\GpsCoordinateValidator;

class ArrivalVerificationService
{
    /**
     * @return array{lat: float, lng: float}|null
     */
    public function resolveDestination(JobOrder $job): ?array
    {
        return GpsCoordinateValidator::pair(
            $job->dropoff_latitude,
            $job->dropoff_longitude,
            'arrival_destination',
        );
    }

    /**
     * @return array{verified: bool, error?: string, distance_meters?: int}
     */
    public function verify(float $driverLat, float $driverLng, JobOrder $job): array
    {
        $destination = $this->resolveDestination($job);
        if (! $destination) {
            return [
                'verified' => false,
                'error'    => 'Destination coordinates could not be determined. Contact dispatch.',
            ];
        }

        $distanceMeters = $this->distanceMeters(
            $driverLat,
            $driverLng,
            $destination['lat'],
            $destination['lng'],
        );

        $radius = (int) config('delivery.arrival_radius_meters', 300);
        if ($distanceMeters > $radius) {
            return [
                'verified'         => false,
                'error'            => 'You are too far from the delivery destination.',
                'distance_meters'  => (int) round($distanceMeters),
                'allowed_meters'   => $radius,
            ];
        }

        return [
            'verified'        => true,
            'distance_meters' => (int) round($distanceMeters),
        ];
    }

    public function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $dLat        = deg2rad($lat2 - $lat1);
        $dLng        = deg2rad($lng2 - $lng1);
        $a           = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }
}
