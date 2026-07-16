<?php

namespace App\Services\Delivery;

use App\Models\JobOrder;
use App\Services\Gps\RouteDirectionsService;

class JobOrderLocationService
{
    public function __construct(
        private AddressGeocoder $geocoder,
        private RouteDirectionsService $directions,
    ) {
    }

    public function ensureCoordinates(JobOrder $jobOrder): JobOrder
    {
        $updates = [];

        if (($jobOrder->pickup_latitude === null || $jobOrder->pickup_longitude === null)
            && $jobOrder->display_pickup !== '') {
            $coords = $this->geocoder->geocode($jobOrder->display_pickup);
            if ($coords) {
                $updates['pickup_latitude'] = $coords['lat'];
                $updates['pickup_longitude'] = $coords['lng'];
            }
        }

        if (($jobOrder->dropoff_latitude === null || $jobOrder->dropoff_longitude === null)
            && $jobOrder->display_dropoff !== '') {
            $coords = $this->geocoder->geocode($jobOrder->display_dropoff);
            if ($coords) {
                $updates['dropoff_latitude'] = $coords['lat'];
                $updates['dropoff_longitude'] = $coords['lng'];
            }
        }

        if ($updates !== []) {
            $jobOrder->update($updates);
            $jobOrder->refresh();
        }

        return $jobOrder;
    }

    /** @return array<string, mixed> */
    public function mapPayload(JobOrder $jobOrder): array
    {
        $jobOrder = $this->ensureCoordinates($jobOrder);

        $pickup = $this->point(
            $jobOrder->pickup_latitude,
            $jobOrder->pickup_longitude,
            $jobOrder->display_pickup,
            'pickup',
        );

        $destination = $this->point(
            $jobOrder->dropoff_latitude,
            $jobOrder->dropoff_longitude,
            $jobOrder->display_dropoff,
            'destination',
        );

        $route = $this->routeBetween($pickup, $destination);

        return [
            'job_order_id' => $jobOrder->id,
            'pickup' => $pickup,
            'destination' => $destination,
            'route' => $route,
        ];
    }

    /** @return array<string, mixed>|null */
    private function point(mixed $lat, mixed $lng, string $address, string $kind): ?array
    {
        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return $address !== '' ? ['address' => $address, 'kind' => $kind] : null;
        }

        return [
            'kind' => $kind,
            'address' => $address,
            'lat' => (float) $lat,
            'lng' => (float) $lng,
        ];
    }

    /** @param  array<string, mixed>|null  $pickup
     * @param  array<string, mixed>|null  $destination
     * @return array<string, mixed>|null
     */
    private function routeBetween(?array $pickup, ?array $destination): ?array
    {
        if (! $pickup || ! $destination
            || ! isset($pickup['lat'], $pickup['lng'], $destination['lat'], $destination['lng'])) {
            return null;
        }

        return $this->directions->route(
            (float) $pickup['lat'],
            (float) $pickup['lng'],
            (float) $destination['lat'],
            (float) $destination['lng'],
        );
    }
}
