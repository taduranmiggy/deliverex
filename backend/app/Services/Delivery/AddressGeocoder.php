<?php

namespace App\Services\Delivery;

use App\Support\GpsCoordinateValidator;
use App\Support\LocationPipelineLogger;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AddressGeocoder
{
    /**
     * Resolve latitude/longitude for an address via OpenStreetMap Nominatim.
     * Successful lookups are cached to avoid repeated external requests.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function geocode(string $address): ?array
    {
        $query = $this->normalizeQuery($address);
        if ($query === '') {
            return null;
        }

        $cacheKey = 'deliverex.geocode.'.md5($query);
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
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Deliverex/1.0 (logistics capstone)',
            ])
                ->timeout(10)
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q'              => $query,
                    'format'         => 'json',
                    'limit'          => 1,
                    'countrycodes'   => 'ph',
                    'addressdetails' => 0,
                ]);

            if (! $response->successful()) {
                Log::warning('Address geocoding HTTP failure', [
                    'address' => $query,
                    'status'  => $response->status(),
                ]);

                return null;
            }

            $results = $response->json();
            if (! is_array($results) || empty($results[0]['lat']) || empty($results[0]['lon'])) {
                return null;
            }

            $coords = [
                'lat' => (float) $results[0]['lat'],
                'lng' => (float) $results[0]['lon'],
            ];

            if (! GpsCoordinateValidator::isUsable($coords['lat'], $coords['lng'])) {
                Log::warning('Geocoder returned invalid coordinates', [
                    'address' => $query,
                    'lat' => $coords['lat'],
                    'lng' => $coords['lng'],
                ]);

                return null;
            }

            LocationPipelineLogger::log('geocode_success', [
                'address' => $query,
                'lat' => $coords['lat'],
                'lng' => $coords['lng'],
            ]);

            return $coords;
        } catch (\Throwable $e) {
            Log::warning('Address geocoding failed', [
                'address' => $query,
                'error'   => $e->getMessage(),
            ]);

            return null;
        }
    }
}
