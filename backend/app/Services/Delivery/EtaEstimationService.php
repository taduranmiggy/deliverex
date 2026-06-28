<?php

namespace App\Services\Delivery;

use App\Models\JobOrder;
use App\Models\TrackingLog;
use App\Support\DeliveryStatus;

class EtaEstimationService
{
    public function __construct(private ArrivalVerificationService $arrivalVerification)
    {
    }

    /**
     * @return array<string, mixed>|null
     */
    public function estimate(JobOrder $job, ?TrackingLog $latestTracking, string $status): ?array
    {
        $normalized = DeliveryStatus::canonicalize($status) ?? $status;

        if (in_array($normalized, [DeliveryStatus::COMPLETED, DeliveryStatus::CANCELLED], true)) {
            return null;
        }

        if ($normalized === DeliveryStatus::ARRIVED) {
            return [
                'available'               => true,
                'estimated_arrival'       => null,
                'estimated_arrival_label' => 'Driver has arrived',
                'remaining_distance_meters' => 0,
                'remaining_distance_km'   => 0,
                'remaining_distance_label'=> 'At destination',
                'average_speed_kmh'       => null,
            ];
        }

        if (! $latestTracking || $latestTracking->latitude === null || $latestTracking->longitude === null) {
            return null;
        }

        if (! in_array($normalized, [
            DeliveryStatus::ASSIGNED,
            DeliveryStatus::EN_ROUTE_TO_PICKUP,
            DeliveryStatus::ARRIVED_AT_PICKUP,
            DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            DeliveryStatus::ARRIVED,
        ], true)) {
            return null;
        }

        $destination = $this->arrivalVerification->resolveDestination($job);
        if (! $destination) {
            return null;
        }

        $distanceMeters = $this->arrivalVerification->distanceMeters(
            (float) $latestTracking->latitude,
            (float) $latestTracking->longitude,
            $destination['lat'],
            $destination['lng'],
        );

        $speedKmh = max(5.0, (float) config('delivery.average_travel_speed_kmh', 30));
        $speedMs  = ($speedKmh * 1000) / 3600;
        $eta      = now()->addSeconds((int) max(60, round($distanceMeters / $speedMs)));

        $tz = config('app.timezone');

        return [
            'available'                => true,
            'estimated_arrival'        => $eta->toIso8601String(),
            'estimated_arrival_label'  => $eta->timezone($tz)->format('g:i A'),
            'remaining_distance_meters'=> (int) round($distanceMeters),
            'remaining_distance_km'    => round($distanceMeters / 1000, 1),
            'remaining_distance_label' => $distanceMeters >= 1000
                ? round($distanceMeters / 1000, 1).' km'
                : round($distanceMeters).' m',
            'average_speed_kmh'          => $speedKmh,
        ];
    }
}
