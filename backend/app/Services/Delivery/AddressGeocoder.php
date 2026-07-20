<?php

namespace App\Services\Delivery;

use App\Support\GeocodeAnchor;
use App\Support\GeocodeResultScorer;
use App\Support\GpsCoordinateValidator;
use App\Support\LocationPipelineLogger;
use App\Support\OpenRouteServiceAuth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AddressGeocoder
{
    public function __construct(
        private GeocodeResultScorer $scorer,
    ) {
    }

    /**
     * Resolve latitude/longitude for an address.
     * Uses OpenRouteService when configured, then falls back to Nominatim.
     *
     * @param  array{city?: string|null, province?: string|null, region?: string|null}|GeocodeAnchor|null  $anchor
     * @return array{lat: float, lng: float}|null
     */
    public function geocode(string $address, GeocodeAnchor|array|null $anchor = null): ?array
    {
        $anchor = $this->normalizeAnchor($anchor);
        $query = $this->normalizeQuery($address);
        if ($query === '') {
            return null;
        }

        $cacheKey = 'deliverex.geocode.v5.'.md5($query.$anchor->cacheKeySuffix());
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['lat'], $cached['lng'])) {
            return $cached;
        }

        $result = $this->performLookup($query, $anchor);
        if ($result) {
            Cache::put($cacheKey, $result, now()->addDays(30));
        }

        return $result;
    }

    /**
     * Try multiple address strings in order until one geocodes successfully.
     *
     * @param  list<string>  $queries
     * @param  array{city?: string|null, province?: string|null, region?: string|null}|GeocodeAnchor|null  $anchor
     * @return array{lat: float, lng: float}|null
     */
    public function geocodeFirst(array $queries, GeocodeAnchor|array|null $anchor = null): ?array
    {
        $anchor = $this->normalizeAnchor($anchor);
        $queries = array_merge($queries, $anchor->geocodeFallbackQueries());
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
            $result = $this->geocode($query, $anchor);
            if ($result) {
                return $result;
            }
        }

        return null;
    }

    /**
     * Validate stored coordinates against the PSGC locality anchor.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function validateStoredCoordinates(
        mixed $latitude,
        mixed $longitude,
        GeocodeAnchor|array|null $anchor = null,
    ): ?array {
        $pair = GpsCoordinateValidator::pair($latitude, $longitude, 'stored_geocode');
        $anchor = $this->normalizeAnchor($anchor);

        if (! $pair || ! $anchor->hasLocality()) {
            return $pair;
        }

        $centroid = $this->resolveAnchorCentroid($anchor);

        if ($this->scorer->storedCoordinatesMatch($anchor, $pair, $centroid)) {
            return $pair;
        }

        LocationPipelineLogger::log('geocode_stored_rejected', [
            'lat' => $pair['lat'],
            'lng' => $pair['lng'],
            'anchor_city' => $anchor->city,
            'anchor_province' => $anchor->province,
            'centroid' => $centroid,
        ]);

        return null;
    }

    /** @param  array{city?: string|null, province?: string|null, region?: string|null}|GeocodeAnchor|null  $anchor */
    private function normalizeAnchor(GeocodeAnchor|array|null $anchor): GeocodeAnchor
    {
        if ($anchor instanceof GeocodeAnchor) {
            return $anchor;
        }

        if (is_array($anchor)) {
            return GeocodeAnchor::fromArray($anchor);
        }

        return new GeocodeAnchor;
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
    private function performLookup(string $query, GeocodeAnchor $anchor): ?array
    {
        $centroid = $anchor->hasLocality() ? $this->resolveAnchorCentroid($anchor) : null;

        $openRoute = $this->performOpenRouteServiceLookup($query, $anchor, $centroid);
        if ($openRoute) {
            return $openRoute;
        }

        return $this->performNominatimLookup($query, $anchor, $centroid);
    }

    /** @return array{lat: float, lng: float}|null */
    private function resolveAnchorCentroid(GeocodeAnchor $anchor): ?array
    {
        if ($preset = $anchor->fallbackCentroid()) {
            return $preset;
        }

        $localityQuery = $anchor->localityQuery();
        if ($localityQuery === null) {
            return null;
        }

        return Cache::remember(
            $anchor->centroidCacheKey(),
            now()->addDays(60),
            function () use ($localityQuery, $anchor): ?array {
                $openRoute = $this->performOpenRouteServiceLookup($localityQuery, $anchor, null);
                if ($openRoute && $this->scorer->coordsWithinExpectedArea($anchor, $openRoute)) {
                    return $openRoute;
                }

                $nominatim = $this->performNominatimLookup($localityQuery, $anchor, null);
                if ($nominatim && $this->scorer->coordsWithinExpectedArea($anchor, $nominatim)) {
                    return $nominatim;
                }

                return $anchor->fallbackCentroid();
            },
        );
    }

    /** @return array{lat: float, lng: float}|null */
    private function performOpenRouteServiceLookup(
        string $query,
        GeocodeAnchor $anchor,
        ?array $centroid,
    ): ?array {
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

            $params = [
                'text' => $query,
                'size' => 5,
                'boundary.country' => 'PH',
            ];

            if ($anchor->isNcr()) {
                $focus = $anchor->focusPoint();
                $params['focus.point.lat'] = $focus['lat'];
                $params['focus.point.lon'] = $focus['lng'];
            }

            $response = Http::timeout(12)
                ->withHeaders($authHeader)
                ->get($url, $params);

            if (! $response->successful()) {
                Log::warning('OpenRouteService geocoding HTTP failure', [
                    'address' => $query,
                    'status' => $response->status(),
                    'body' => $response->json(),
                ]);

                return null;
            }

            return $this->pickBestFeature(
                $response->json()['features'] ?? [],
                $query,
                'openrouteservice',
                $anchor,
                $centroid,
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
    private function performNominatimLookup(
        string $query,
        GeocodeAnchor $anchor,
        ?array $centroid,
    ): ?array {
        try {
            $params = [
                'q' => $query,
                'format' => 'json',
                'limit' => 5,
                'countrycodes' => 'ph',
                'addressdetails' => 1,
            ];

            if ($anchor->isNcr()) {
                $params['viewbox'] = '120.90,14.78,121.10,14.42';
                $params['bounded'] = 1;
            }

            $response = Http::withHeaders([
                'User-Agent' => 'Deliverex/1.0 (logistics capstone)',
            ])
                ->timeout(10)
                ->get('https://nominatim.openstreetmap.org/search', $params);

            if (! $response->successful()) {
                Log::warning('Address geocoding HTTP failure', [
                    'address' => $query,
                    'status' => $response->status(),
                ]);

                return null;
            }

            $results = $response->json();
            if (! is_array($results)) {
                return null;
            }

            $best = null;
            $bestScore = -1.0;

            foreach ($results as $result) {
                if (! is_array($result) || empty($result['lat']) || empty($result['lon'])) {
                    continue;
                }

                $coords = $this->validateCoordinates(
                    (float) $result['lat'],
                    (float) $result['lon'],
                    $query,
                    'nominatim',
                    false,
                );

                if (! $coords) {
                    continue;
                }

                $labels = $this->extractNominatimLabels($result);
                $score = $this->scorer->score($anchor, $coords, $labels, $centroid);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $best = $coords;
                }
            }

            if ($best) {
                LocationPipelineLogger::log('geocode_success', [
                    'address' => $query,
                    'source' => 'nominatim',
                    'lat' => $best['lat'],
                    'lng' => $best['lng'],
                    'score' => $bestScore,
                ]);
            }

            return $best;
        } catch (\Throwable $e) {
            Log::warning('Address geocoding failed', [
                'address' => $query,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @param  list<mixed>  $features
     * @return array{lat: float, lng: float}|null
     */
    private function pickBestFeature(
        array $features,
        string $query,
        string $source,
        GeocodeAnchor $anchor,
        ?array $centroid,
    ): ?array {
        $best = null;
        $bestScore = -1.0;

        foreach ($features as $feature) {
            if (! is_array($feature)) {
                continue;
            }

            $coordinates = $feature['geometry']['coordinates'] ?? null;
            if (! is_array($coordinates) || count($coordinates) < 2) {
                continue;
            }

            $coords = $this->validateCoordinates(
                (float) $coordinates[1],
                (float) $coordinates[0],
                $query,
                $source,
                false,
            );

            if (! $coords) {
                continue;
            }

            $properties = is_array($feature['properties'] ?? null) ? $feature['properties'] : [];
            $labels = $this->extractOpenRouteLabels($properties);
            $score = $this->scorer->score($anchor, $coords, $labels, $centroid);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $coords;
            }
        }

        if ($best) {
            LocationPipelineLogger::log('geocode_success', [
                'address' => $query,
                'source' => $source,
                'lat' => $best['lat'],
                'lng' => $best['lng'],
                'score' => $bestScore,
            ]);
        }

        return $best;
    }

    /** @param  array<string, mixed>  $properties
     * @return list<string>
     */
    private function extractOpenRouteLabels(array $properties): array
    {
        $labels = [];

        foreach (['name', 'street', 'locality', 'localadmin', 'county', 'macrocounty', 'region', 'label'] as $field) {
            $value = trim((string) ($properties[$field] ?? ''));
            if ($value !== '') {
                $labels[] = $value;
            }
        }

        return $labels;
    }

    /** @param  array<string, mixed>  $result
     * @return list<string>
     */
    private function extractNominatimLabels(array $result): array
    {
        $labels = [];
        $display = trim((string) ($result['display_name'] ?? ''));
        if ($display !== '') {
            $labels[] = $display;
        }

        $address = is_array($result['address'] ?? null) ? $result['address'] : [];
        foreach (['road', 'suburb', 'city', 'town', 'municipality', 'county', 'state', 'region'] as $field) {
            $value = trim((string) ($address[$field] ?? ''));
            if ($value !== '') {
                $labels[] = $value;
            }
        }

        return $labels;
    }

    /** @return array{lat: float, lng: float}|null */
    private function validateCoordinates(
        float $lat,
        float $lng,
        string $query,
        string $source,
        bool $logSuccess = true,
    ): ?array {
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

        if ($logSuccess) {
            LocationPipelineLogger::log('geocode_success', [
                'address' => $query,
                'source' => $source,
                'lat' => $coords['lat'],
                'lng' => $coords['lng'],
            ]);
        }

        return $coords;
    }
}
