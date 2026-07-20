<?php

namespace App\Services\Delivery;

use App\Services\Geocoding\GoogleMapsClient;
use App\Services\Geocoding\LogGeocodeSelection;
use App\Support\GeocodeAnchor;
use App\Support\GeocodeResultScorer;
use App\Support\GpsCoordinateValidator;
use App\Support\LocationPipelineLogger;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AddressGeocoder
{
    public function __construct(
        private GeocodeResultScorer $scorer,
        private GoogleMapsClient $googleMaps,
    ) {
    }

    /**
     * Resolve latitude/longitude for an address using Google Geocoding API.
     *
     * @param  array{city?: string|null, province?: string|null, region?: string|null}|GeocodeAnchor|null  $anchor
     * @return array{lat: float, lng: float, place_id?: string|null, formatted_address?: string|null}|null
     */
    public function geocode(string $address, GeocodeAnchor|array|null $anchor = null): ?array
    {
        $anchor = $this->normalizeAnchor($anchor);
        $query = $this->normalizeQuery($address);
        if ($query === '') {
            return null;
        }

        if (! $this->googleMaps->isConfigured()) {
            Log::warning('Google Maps geocoding skipped because GOOGLE_MAPS_API_KEY is not configured.', [
                'address' => $query,
            ]);

            return null;
        }

        $cacheKey = 'deliverex.geocode.google.v1.'.md5($query.$anchor->cacheKeySuffix());
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['lat'], $cached['lng'])) {
            return $cached;
        }

        $result = $this->performLookup($query, $anchor);
        if ($result) {
            Cache::put($cacheKey, $result, now()->addDays(30));
            LogGeocodeSelection::log($query, $query, $result);
        }

        return $result;
    }

    /**
     * Try multiple address strings in order until one geocodes successfully.
     *
     * @param  list<string>  $queries
     * @param  array{city?: string|null, province?: string|null, region?: string|null}|GeocodeAnchor|null  $anchor
     * @return array{lat: float, lng: float, place_id?: string|null, formatted_address?: string|null}|null
     */
    public function geocodeFirst(
        array $queries,
        GeocodeAnchor|array|null $anchor = null,
        bool $streetStrict = false,
    ): ?array {
        $anchor = $this->normalizeAnchor($anchor);
        if (! $streetStrict) {
            $queries = array_merge($queries, $anchor->geocodeFallbackQueries());
        }
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

    /** @return array{lat: float, lng: float, place_id?: string|null, formatted_address?: string|null}|null */
    private function performLookup(string $query, GeocodeAnchor $anchor, bool $allowCentroid = true): ?array
    {
        $centroid = $allowCentroid && $anchor->hasLocality()
            ? $this->resolveAnchorCentroid($anchor)
            : null;

        try {
            $response = $this->googleMaps->geocodeAddress($query);
        } catch (\Throwable $exception) {
            Log::warning('Google Geocoding failed', [
                'address' => $query,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }

        if ($response === null) {
            return null;
        }

        return $this->pickBestResult($response['results'] ?? [], $query, $anchor, $centroid);
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
                $result = $this->performLookup($localityQuery, $anchor, false);
                if ($result && $this->scorer->coordsWithinExpectedArea($anchor, $result)) {
                    return ['lat' => $result['lat'], 'lng' => $result['lng']];
                }

                return $anchor->fallbackCentroid();
            },
        );
    }

    /**
     * @param  list<mixed>  $results
     * @return array{lat: float, lng: float, place_id?: string|null, formatted_address?: string|null}|null
     */
    private function pickBestResult(
        array $results,
        string $query,
        GeocodeAnchor $anchor,
        ?array $centroid,
    ): ?array {
        $best = null;
        $bestScore = -1.0;

        foreach ($results as $result) {
            if (! is_array($result)) {
                continue;
            }

            $location = $result['geometry']['location'] ?? null;
            if (! is_array($location) || ! isset($location['lat'], $location['lng'])) {
                continue;
            }

            $coords = $this->validateCoordinates(
                (float) $location['lat'],
                (float) $location['lng'],
                $query,
                'google_geocoding',
                false,
            );

            if (! $coords) {
                continue;
            }

            $labels = $this->extractGoogleLabels($result);
            $score = $this->scorer->score($anchor, $coords, $labels, $centroid, $query);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = array_merge($coords, [
                    'place_id' => $result['place_id'] ?? null,
                    'formatted_address' => $result['formatted_address'] ?? null,
                ]);
            }
        }

        if ($best) {
            LocationPipelineLogger::log('geocode_success', [
                'address' => $query,
                'source' => 'google_geocoding',
                'lat' => $best['lat'],
                'lng' => $best['lng'],
                'place_id' => $best['place_id'] ?? null,
                'score' => $bestScore,
            ]);
        }

        return $best;
    }

    /** @param  array<string, mixed>  $result
     * @return list<string>
     */
    private function extractGoogleLabels(array $result): array
    {
        $labels = [];
        $formatted = trim((string) ($result['formatted_address'] ?? ''));
        if ($formatted !== '') {
            $labels[] = $formatted;
        }

        foreach ((array) ($result['address_components'] ?? []) as $component) {
            if (! is_array($component)) {
                continue;
            }

            foreach (['long_name', 'short_name'] as $field) {
                $value = trim((string) ($component[$field] ?? ''));
                if ($value !== '') {
                    $labels[] = $value;
                }
            }
        }

        return array_values(array_unique($labels));
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
