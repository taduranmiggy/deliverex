<?php

namespace App\Services\Delivery;

use App\Support\GpsCoordinateValidator;
use App\Support\LocationPipelineLogger;
use App\Support\OpenRouteServiceAuth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AddressGeocoder
{
    /**
     * Resolve latitude/longitude for an address.
     * Uses OpenRouteService when configured, then falls back to Nominatim.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function geocode(string $address): ?array
    {
        $query = $this->normalizeQuery($address);
        if ($query === '') {
            return null;
        }

        $cacheKey = 'deliverex.geocode.v2.'.md5($query);
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['lat'], $cached['lng'])) {
            return $cached;
        }

        $result = $this->performLookup($query);
        if ($result) {
            Cache::put($cacheKey, $result, now()->addDays(30));
        }

        return $result;
    }

    /**
     * Try multiple address strings in order until one geocodes successfully.
     *
     * @param  list<string>  $queries
     * @return array{lat: float, lng: float}|null
     */
    public function geocodeFirst(array $queries): ?array
    {
        $attempted = false;

        foreach ($queries as $query) {
            $query = trim($query);
            if ($query === '') {
                continue;
            }

            if ($attempted) {
                usleep(350_000);
            }

            $attempted = true;
            $result = $this->geocode($query);
            if ($result) {
                return $result;
            }
        }

        return null;
    }

    private function normalizeQuery(string $address): string
    {
        $query = trim($address);
        if ($query === '') {
            return '';
        }

        if (! str_contains(strtolower($query), 'philippines')) {
            $query .= ', Philippines';
        }

        return $query;
    }

    /** @return array{lat: float, lng: float}|null */
    private function performLookup(string $query): ?array
    {
        $openRoute = $this->performOpenRouteServiceLookup($query);
        if ($openRoute) {
            return $openRoute;
        }

        return $this->performNominatimLookup($query);
    }

    /** @return array{lat: float, lng: float}|null */
    private function performOpenRouteServiceLookup(string $query): ?array
    {
        $apiKey = config('gps.routing.openrouteservice_api_key');
        $authHeader = OpenRouteServiceAuth::authorizationHeader(is_string($apiKey) ? $apiKey : null);
        if (! $authHeader) {
            return null;
        }

        try {
            $url = config(
                'gps.geocoding.openrouteservice_url',
                'https://api.openrouteservice.org/geocode/search',
            );

            $response = Http::timeout(12)
                ->withHeaders($authHeader)
                ->get($url, [
                    'text' => $query,
                    'size' => 1,
                    'boundary.country' => 'PH',
                ]);

            if (! $response->successful()) {
                Log::warning('OpenRouteService geocoding HTTP failure', [
                    'address' => $query,
                    'status' => $response->status(),
                    'body' => $response->json(),
                ]);

                return null;
            }

            $feature = $response->json()['features'][0] ?? null;
            $coordinates = is_array($feature) ? ($feature['geometry']['coordinates'] ?? null) : null;
            if (! is_array($coordinates) || count($coordinates) < 2) {
                return null;
            }

            return $this->validateCoordinates(
                (float) $coordinates[1],
                (float) $coordinates[0],
                $query,
                'openrouteservice',
            );
        } catch (\Throwable $e) {
            Log::warning('OpenRouteService geocoding failed', [
                'address' => $query,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /** @return array{lat: float, lng: float}|null */
    private function performNominatimLookup(string $query): ?array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Deliverex/1.0 (logistics capstone)',
            ])
                ->timeout(10)
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q' => $query,
                    'format' => 'json',
                    'limit' => 1,
                    'countrycodes' => 'ph',
                    'addressdetails' => 0,
                ]);

            if (! $response->successful()) {
                Log::warning('Address geocoding HTTP failure', [
                    'address' => $query,
                    'status' => $response->status(),
                ]);

                return null;
            }

            $results = $response->json();
            if (! is_array($results) || empty($results[0]['lat']) || empty($results[0]['lon'])) {
                return null;
            }

            return $this->validateCoordinates(
                (float) $results[0]['lat'],
                (float) $results[0]['lon'],
                $query,
                'nominatim',
            );
        } catch (\Throwable $e) {
            Log::warning('Address geocoding failed', [
                'address' => $query,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /** @return array{lat: float, lng: float}|null */
    private function validateCoordinates(float $lat, float $lng, string $query, string $source): ?array
    {
        $coords = ['lat' => $lat, 'lng' => $lng];

        if (! GpsCoordinateValidator::isUsable($coords['lat'], $coords['lng'])) {
            Log::warning('Geocoder returned invalid coordinates', [
                'address' => $query,
                'source' => $source,
                'lat' => $coords['lat'],
                'lng' => $coords['lng'],
            ]);

            return null;
        }

        LocationPipelineLogger::log('geocode_success', [
            'address' => $query,
            'source' => $source,
            'lat' => $coords['lat'],
            'lng' => $coords['lng'],
        ]);

        return $coords;
    }
}
