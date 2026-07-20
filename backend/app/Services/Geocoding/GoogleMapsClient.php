<?php

namespace App\Services\Geocoding;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class GoogleMapsClient
{
    private const AUTocomplete_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

    private const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

    private const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

    public function isConfigured(): bool
    {
        return trim((string) config('gps.geocoding.google_maps_api_key', '')) !== '';
    }

    public function apiKey(): string
    {
        $key = trim((string) config('gps.geocoding.google_maps_api_key', ''));
        if ($key === '') {
            throw new RuntimeException('Google Maps API key is not configured. Set GOOGLE_MAPS_API_KEY in the environment.');
        }

        return $key;
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function placeAutocomplete(string $input, array $options = []): array
    {
        $params = array_merge([
            'input' => $input,
            'key' => $this->apiKey(),
            'components' => 'country:ph',
            'language' => 'en',
        ], $options);

        return $this->request('autocomplete', self::AUTocomplete_URL, $params);
    }

    /** @return array<string, mixed>|null */
    public function placeDetails(string $placeId): ?array
    {
        $params = [
            'place_id' => $placeId,
            'key' => $this->apiKey(),
            'fields' => 'place_id,formatted_address,geometry,name,address_component,types',
            'language' => 'en',
        ];

        $response = $this->request('place_details', self::PLACE_DETAILS_URL, $params);
        $result = $response['result'] ?? null;

        return is_array($result) ? $result : null;
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>|null
     */
    public function geocodeAddress(string $address, array $options = []): ?array
    {
        $params = array_merge([
            'address' => $address,
            'key' => $this->apiKey(),
            'region' => 'ph',
            'language' => 'en',
        ], $options);

        $response = $this->request('geocode', self::GEOCODE_URL, $params);
        if (($response['status'] ?? '') !== 'OK' || ! is_array($response['results'] ?? null) || $response['results'] === []) {
            return null;
        }

        return $response;
    }

    /** @return array<string, mixed>|null */
    public function geocodePlaceId(string $placeId): ?array
    {
        $params = [
            'place_id' => $placeId,
            'key' => $this->apiKey(),
            'language' => 'en',
        ];

        $response = $this->request('geocode_place_id', self::GEOCODE_URL, $params);
        if (($response['status'] ?? '') !== 'OK' || ! is_array($response['results'] ?? null) || $response['results'] === []) {
            return null;
        }

        return $response;
    }

    /** @return array<string, mixed>|null */
    public function reverseGeocode(float $lat, float $lng): ?array
    {
        $params = [
            'latlng' => "{$lat},{$lng}",
            'key' => $this->apiKey(),
            'language' => 'en',
        ];

        $response = $this->request('reverse_geocode', self::GEOCODE_URL, $params);
        $results = $response['results'] ?? [];

        return is_array($results) && $results !== [] && is_array($results[0]) ? $results[0] : null;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function request(string $operation, string $url, array $params): array
    {
        $safeParams = $params;
        unset($safeParams['key']);

        Log::info('[google-geocode-pipeline] request', [
            'operation' => $operation,
            'url' => $url,
            'params' => $safeParams,
        ]);

        $cacheKey = 'deliverex.google_maps.v1.'.hash('sha256', $operation.'|'.json_encode($safeParams));
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            Log::info('[google-geocode-pipeline] cached_response', [
                'operation' => $operation,
                'google_status' => $cached['status'] ?? null,
            ]);

            return $cached;
        }

        $response = Http::timeout(15)->get($url, $params);
        $payload = $response->json();
        $payload = is_array($payload) ? $payload : [
            'status' => 'HTTP_ERROR',
            'raw_body' => mb_substr($response->body(), 0, 20000),
        ];

        Log::info('[google-geocode-pipeline] response', [
            'operation' => $operation,
            'http_status' => $response->status(),
            'google_status' => $payload['status'] ?? null,
            'response' => $this->truncateForLog($payload),
        ]);

        if ($response->successful() && in_array($payload['status'] ?? '', ['OK', 'ZERO_RESULTS'], true)) {
            $ttl = match ($operation) {
                'autocomplete' => 10,
                'place_details' => 30,
                default => 60,
            };
            Cache::put($cacheKey, $payload, now()->addMinutes($ttl));
        }

        return $payload;
    }

    /** @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function truncateForLog(array $payload): array
    {
        foreach (['predictions', 'results'] as $key) {
            if (! isset($payload[$key]) || ! is_array($payload[$key])) {
                continue;
            }

            $payload[$key] = array_slice($payload[$key], 0, 5);
        }

        return $payload;
    }
}
