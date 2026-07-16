<?php

namespace App\Services\Gps;

use App\Support\GpsCoordinateValidator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RouteDirectionsService
{
    /**
     * @return array<string, mixed>
     */
    public function route(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $ors = $this->fetchOpenRouteService($fromLng, $fromLat, $toLng, $toLat);
        if ($ors) {
            return $ors;
        }

        $osrm = $this->fetchOsrmRoute($fromLng, $fromLat, $toLng, $toLat);
        if ($osrm) {
            return $osrm;
        }

        return $this->straightLineRoute($fromLat, $fromLng, $toLat, $toLng);
    }

    /** @return array<string, mixed>|null */
    private function fetchOpenRouteService(float $fromLng, float $fromLat, float $toLng, float $toLat): ?array
    {
        $apiKey = config('gps.routing.openrouteservice_api_key');
        if (! $apiKey) {
            return null;
        }

        try {
            $url = config('gps.routing.openrouteservice_url', 'https://api.openrouteservice.org/v2/directions/driving-car');
            $response = Http::timeout(10)
                ->withHeaders(['Authorization' => $apiKey])
                ->post($url, [
                    'coordinates' => [
                        [$fromLng, $fromLat],
                        [$toLng, $toLat],
                    ],
                ]);

            if (! $response->successful()) {
                return null;
            }

            $payload = $response->json();
            $feature = $payload['features'][0] ?? null;
            if (! $feature) {
                return null;
            }

            $polyline = [];
            foreach ($feature['geometry']['coordinates'] ?? [] as $coord) {
                if (is_array($coord) && count($coord) >= 2) {
                    $polyline[] = [(float) $coord[1], (float) $coord[0]];
                }
            }

            $summary = $feature['properties']['summary'] ?? [];
            $distanceM = (float) ($summary['distance'] ?? 0);
            $durationSec = (float) ($summary['duration'] ?? 0);
            $durationMin = max(1, (int) round($durationSec / 60));

            return [
                'polyline' => $polyline,
                'distance_km' => round($distanceM / 1000, 2),
                'distance_meters' => (int) round($distanceM),
                'distance_label' => $this->formatDistance($distanceM),
                'duration_minutes' => $durationMin,
                'duration_seconds' => (int) round($durationSec),
                'duration_label' => $this->formatDuration($durationMin),
                'source' => 'openrouteservice',
            ];
        } catch (\Throwable $e) {
            Log::warning('OpenRouteService lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
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
                'distance_meters' => (int) round($distanceM),
                'distance_label' => $this->formatDistance($distanceM),
                'duration_minutes' => $durationMin,
                'duration_seconds' => (int) round($durationSec),
                'duration_label' => $this->formatDuration($durationMin),
                'source' => 'osrm',
            ];
        } catch (\Throwable $e) {
            Log::warning('OSRM route lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /** @return array<string, mixed> */
    private function straightLineRoute(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $distanceM = GpsCoordinateValidator::distanceMeters($fromLat, $fromLng, $toLat, $toLng);
        $durationMin = $this->estimateDurationMinutes($distanceM);

        return [
            'polyline' => [
                [$fromLat, $fromLng],
                [$toLat, $toLng],
            ],
            'distance_km' => round($distanceM / 1000, 2),
            'distance_meters' => (int) round($distanceM),
            'distance_label' => $this->formatDistance($distanceM),
            'duration_minutes' => $durationMin,
            'duration_seconds' => $durationMin * 60,
            'duration_label' => $this->formatDuration($durationMin),
            'source' => 'straight_line',
        ];
    }

    private function estimateDurationMinutes(float $distanceMeters): int
    {
        $avgSpeedKmh = (float) config('delivery.average_travel_speed_kmh', 35);

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
