<?php

namespace App\Services\Delivery;

use App\Models\JobOrder;
use App\Support\GpsCoordinateValidator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class JobOrderLocationService
{
    public function __construct(private AddressGeocoder $geocoder)
    {
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

        $osrm = $this->fetchOsrmRoute(
            (float) $pickup['lng'],
            (float) $pickup['lat'],
            (float) $destination['lng'],
            (float) $destination['lat'],
        );

        if ($osrm) {
            return $osrm;
        }

        $distanceM = GpsCoordinateValidator::distanceMeters(
            (float) $pickup['lat'],
            (float) $pickup['lng'],
            (float) $destination['lat'],
            (float) $destination['lng'],
        );

        return [
            'polyline' => [
                [(float) $pickup['lat'], (float) $pickup['lng']],
                [(float) $destination['lat'], (float) $destination['lng']],
            ],
            'distance_km' => round($distanceM / 1000, 2),
            'distance_label' => $this->formatDistance($distanceM),
            'duration_minutes' => $this->estimateDurationMinutes($distanceM),
            'duration_label' => $this->formatDuration($this->estimateDurationMinutes($distanceM)),
            'source' => 'straight_line',
        ];
    }

    /** @return array<string, mixed>|null */
    private function fetchOsrmRoute(float $fromLng, float $fromLat, float $toLng, float $toLat): ?array
    {
        try {
            $url = sprintf(
                'https://router.project-osrm.org/route/v1/driving/%F,%F;%F,%F',
                $fromLng,
                $fromLat,
                $toLng,
                $toLat,
            );

            $response = Http::timeout(8)->get($url, [
                'overview' => 'full',
                'geometries' => 'geojson',
            ]);

            if (! $response->successful()) {
                return null;
            }

            $payload = $response->json();
            $route = $payload['routes'][0] ?? null;
            if (! $route) {
                return null;
            }

            $polyline = [];
            foreach ($route['geometry']['coordinates'] ?? [] as $coord) {
                if (is_array($coord) && count($coord) >= 2) {
                    $polyline[] = [(float) $coord[1], (float) $coord[0]];
                }
            }

            $distanceM = (float) ($route['distance'] ?? 0);
            $durationSec = (float) ($route['duration'] ?? 0);
            $durationMin = max(1, (int) round($durationSec / 60));

            return [
                'polyline' => $polyline,
                'distance_km' => round($distanceM / 1000, 2),
                'distance_label' => $this->formatDistance($distanceM),
                'duration_minutes' => $durationMin,
                'duration_label' => $this->formatDuration($durationMin),
                'source' => 'osrm',
            ];
        } catch (\Throwable $e) {
            Log::warning('OSRM route lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function estimateDurationMinutes(float $distanceMeters): int
    {
        $avgSpeedKmh = 35;

        return max(1, (int) round(($distanceMeters / 1000) / $avgSpeedKmh * 60));
    }

    private function formatDistance(float $distanceMeters): string
    {
        if ($distanceMeters >= 1000) {
            return number_format($distanceMeters / 1000, 1).' km';
        }

        return number_format($distanceMeters, 0).' m';
    }

    private function formatDuration(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes.' min';
        }

        $hours = intdiv($minutes, 60);
        $remaining = $minutes % 60;

        return $remaining > 0 ? "{$hours} hr {$remaining} min" : "{$hours} hr";
    }
}
