<?php

namespace App\Services\Geocoding;

use App\Models\GeocodingTrace;
use App\Models\User;
use App\Support\GpsCoordinateValidator;
use Illuminate\Support\Str;
use RuntimeException;

class LocationAutocompleteService
{
    public function __construct(
        private GoogleMapsClient $googleMaps,
    ) {
    }

    /** @return array{trace: GeocodingTrace, candidates: list<array<string, mixed>>} */
    public function search(array $input, ?User $user): array
    {
        $raw = trim((string) ($input['query'] ?? ''));
        $normalized = $this->normalizedQuery($raw, $input);
        if (mb_strlen($raw) < 3) {
            throw new RuntimeException('Type at least 3 characters to search for a precise place.');
        }

        if (! $this->googleMaps->isConfigured()) {
            throw new RuntimeException('Google Maps is not configured. Set GOOGLE_MAPS_API_KEY in the environment.');
        }

        $requestParams = [
            'input' => $normalized,
            'components' => 'country:ph',
            'language' => 'en',
        ];

        $response = $this->googleMaps->placeAutocomplete($normalized, [
            'components' => 'country:ph',
            'language' => 'en',
        ]);

        $parsed = $this->parseCandidates($response, $raw, $input);
        $candidates = $parsed['eligible'];
        $allCandidates = $parsed['all'];

        $trace = GeocodingTrace::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user?->id,
            'context' => trim((string) ($input['context'] ?? 'address')) ?: 'address',
            'raw_input' => $raw,
            'normalized_address' => $normalized,
            'provider' => 'google_places',
            'request_url' => 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            'request_payload' => $requestParams,
            'response_payload' => [
                'selected_provider_response' => $response,
                'provider_attempts' => [[
                    'provider' => 'google_places',
                    'status' => $response['status'] ?? 'UNKNOWN',
                    'cached' => false,
                ]],
            ],
            'candidates' => $allCandidates,
            'status' => $candidates === [] ? 'no_results' : 'searched',
            'error_message' => ($response['status'] ?? '') === 'ZERO_RESULTS'
                ? 'Google Places returned no matching addresses.'
                : null,
        ]);

        return ['trace' => $trace, 'candidates' => $candidates];
    }

    /**
     * Geocode a manually entered address when no autocomplete suggestion matches.
     *
     * @return array{trace: GeocodingTrace, candidate: array<string, mixed>|null}
     */
    public function geocodeManual(array $input, ?User $user): array
    {
        $raw = trim((string) ($input['query'] ?? ''));
        $normalized = $this->normalizedQuery($raw, $input);
        if (mb_strlen($raw) < 3) {
            throw new RuntimeException('Type at least 3 characters to geocode this address.');
        }

        if (! $this->googleMaps->isConfigured()) {
            throw new RuntimeException('Google Maps is not configured. Set GOOGLE_MAPS_API_KEY in the environment.');
        }

        $response = $this->googleMaps->geocodeAddress($normalized);
        $candidate = null;
        $allCandidates = [];

        if ($response !== null) {
            foreach ((array) ($response['results'] ?? []) as $index => $result) {
                if (! is_array($result)) {
                    continue;
                }

                $parsed = $this->googleGeocodeCandidate($result, $index);
                if (! $parsed) {
                    continue;
                }

                if (! $this->administrativelyCompatible($parsed, $input)) {
                    $parsed['eligible'] = false;
                    $parsed['rejection_reason'] = 'Candidate conflicts with the selected PSGC city or province.';
                    $allCandidates[] = $parsed;

                    continue;
                }

                $parsed['eligible'] = true;
                $parsed['rejection_reason'] = null;
                $parsed['score'] = $this->score($parsed, $raw, $input);
                $allCandidates[] = $parsed;

                if ($candidate === null) {
                    $candidate = $parsed;
                }
            }
        }

        $trace = GeocodingTrace::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user?->id,
            'context' => trim((string) ($input['context'] ?? 'address')) ?: 'address',
            'raw_input' => $raw,
            'normalized_address' => $normalized,
            'provider' => 'google_geocoding',
            'request_url' => 'https://maps.googleapis.com/maps/api/geocode/json',
            'request_payload' => ['address' => $normalized, 'region' => 'ph'],
            'response_payload' => [
                'selected_provider_response' => $response,
                'provider_attempts' => [[
                    'provider' => 'google_geocoding',
                    'status' => is_array($response) ? ($response['status'] ?? 'ZERO_RESULTS') : 'ZERO_RESULTS',
                ]],
            ],
            'candidates' => $allCandidates,
            'status' => $candidate === null ? 'no_results' : 'searched',
            'error_message' => $candidate === null
                ? 'Google Geocoding could not resolve this address.'
                : null,
        ]);

        if ($candidate) {
            LogGeocodeSelection::log($raw, $normalized, $candidate);
        }

        return ['trace' => $trace, 'candidate' => $candidate];
    }

    /** @return array{eligible: list<array<string, mixed>>, all: list<array<string, mixed>>} */
    private function parseCandidates(array $payload, string $raw, array $context): array
    {
        $predictions = $payload['predictions'] ?? [];
        if (! is_array($predictions)) {
            return ['eligible' => [], 'all' => []];
        }

        $candidates = [];
        $allCandidates = [];

        foreach (array_slice($predictions, 0, 8) as $index => $prediction) {
            if (! is_array($prediction)) {
                continue;
            }

            $candidate = $this->googlePredictionCandidate($prediction, $index);
            if (! $candidate) {
                continue;
            }

            if (! $this->administrativelyCompatible($candidate, $context)) {
                $candidate['eligible'] = false;
                $candidate['rejection_reason'] = 'Candidate conflicts with the selected PSGC city or province.';
                $allCandidates[] = $candidate;

                continue;
            }

            $candidate['eligible'] = true;
            $candidate['rejection_reason'] = null;
            $candidate['score'] = $this->score($candidate, $raw, $context);
            $candidates[] = $candidate;
            $allCandidates[] = $candidate;
        }

        usort($candidates, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        return [
            'eligible' => array_slice($candidates, 0, 8),
            'all' => $allCandidates,
        ];
    }

    /** @return array<string, mixed>|null */
    private function googlePredictionCandidate(array $prediction, int $index): ?array
    {
        $placeId = trim((string) ($prediction['place_id'] ?? ''));
        if ($placeId === '') {
            return null;
        }

        $details = $this->googleMaps->placeDetails($placeId);
        if (! $details) {
            return null;
        }

        $location = $details['geometry']['location'] ?? null;
        if (! is_array($location) || ! isset($location['lat'], $location['lng'])) {
            return null;
        }

        $pair = GpsCoordinateValidator::pair($location['lat'], $location['lng'], 'google_places');
        if (! $pair) {
            return null;
        }

        $structured = is_array($prediction['structured_formatting'] ?? null)
            ? $prediction['structured_formatting']
            : [];
        $mainText = trim((string) ($structured['main_text'] ?? $details['name'] ?? ''));
        $secondaryText = trim((string) ($structured['secondary_text'] ?? ''));
        $formatted = trim((string) ($details['formatted_address'] ?? $prediction['description'] ?? ''));

        $candidate = [
            'provider' => 'google_places',
            'place_id' => $placeId,
            'name' => $mainText !== '' ? $mainText : $formatted,
            'label' => $formatted,
            'secondary_label' => $secondaryText,
            'lat' => $pair['lat'],
            'lng' => $pair['lng'],
            'type' => $this->primaryType($details['types'] ?? []),
            'confidence' => null,
            'components' => $this->componentsFromGoogle($details),
            'matched_substrings' => $structured['main_text_matched_substrings'] ?? [],
        ];

        $candidate['id'] = substr(hash('sha256', implode('|', [
            'google_places',
            $placeId,
            $candidate['label'],
            $candidate['lat'],
            $candidate['lng'],
            $index,
        ])), 0, 24);

        LogGeocodeSelection::log($prediction['description'] ?? $mainText, $placeId, $candidate);

        return $candidate;
    }

    /** @return array<string, mixed>|null */
    private function googleGeocodeCandidate(array $result, int $index): ?array
    {
        $location = $result['geometry']['location'] ?? null;
        if (! is_array($location) || ! isset($location['lat'], $location['lng'])) {
            return null;
        }

        $pair = GpsCoordinateValidator::pair($location['lat'], $location['lng'], 'google_geocoding');
        if (! $pair) {
            return null;
        }

        $placeId = trim((string) ($result['place_id'] ?? ''));
        $formatted = trim((string) ($result['formatted_address'] ?? ''));

        $candidate = [
            'provider' => 'google_geocoding',
            'place_id' => $placeId !== '' ? $placeId : null,
            'name' => $this->primaryNameFromComponents($result),
            'label' => $formatted,
            'secondary_label' => '',
            'lat' => $pair['lat'],
            'lng' => $pair['lng'],
            'type' => $this->primaryType($result['types'] ?? []),
            'confidence' => null,
            'components' => $this->componentsFromGoogle($result),
            'matched_substrings' => [],
        ];

        $candidate['id'] = substr(hash('sha256', implode('|', [
            'google_geocoding',
            $placeId,
            $candidate['label'],
            $candidate['lat'],
            $candidate['lng'],
            $index,
        ])), 0, 24);

        return $candidate;
    }

    /** @param  list<mixed>  $types */
    private function primaryType(array $types): string
    {
        foreach ($types as $type) {
            if (! is_string($type) || $type === 'geocode' || $type === 'establishment') {
                continue;
            }

            return str_replace('_', ' ', $type);
        }

        return 'place';
    }

    /** @return array<string, mixed> */
    private function componentsFromGoogle(array $payload): array
    {
        $components = [];
        foreach ((array) ($payload['address_components'] ?? []) as $component) {
            if (! is_array($component)) {
                continue;
            }

            $types = (array) ($component['types'] ?? []);
            $longName = trim((string) ($component['long_name'] ?? ''));
            if ($longName === '') {
                continue;
            }

            if (in_array('street_number', $types, true)) {
                $components['housenumber'] = $longName;
            } elseif (in_array('route', $types, true)) {
                $components['street'] = $longName;
            } elseif (in_array('sublocality', $types, true) || in_array('neighborhood', $types, true)) {
                $components['district'] = $longName;
            } elseif (in_array('locality', $types, true)) {
                $components['city'] = $longName;
            } elseif (in_array('administrative_area_level_2', $types, true)) {
                $components['county'] = $longName;
            } elseif (in_array('administrative_area_level_1', $types, true)) {
                $components['state'] = $longName;
            } elseif (in_array('country', $types, true)) {
                $components['country'] = $longName;
                $components['country_code'] = strtoupper((string) ($component['short_name'] ?? ''));
            }
        }

        return $components;
    }

    /** @param  array<string, mixed>  $result */
    private function primaryNameFromComponents(array $result): string
    {
        foreach ((array) ($result['address_components'] ?? []) as $component) {
            if (! is_array($component)) {
                continue;
            }

            $types = (array) ($component['types'] ?? []);
            if (in_array('establishment', $types, true) || in_array('point_of_interest', $types, true)) {
                return trim((string) ($component['long_name'] ?? ''));
            }
        }

        return trim((string) ($result['formatted_address'] ?? ''));
    }

    private function score(array $candidate, string $raw, array $context): float
    {
        $type = strtolower((string) ($candidate['type'] ?? 'place'));
        $typeWeights = [
            'street address' => 55, 'premise' => 55, 'subpremise' => 52,
            'point of interest' => 50, 'establishment' => 48, 'route' => 38,
            'place' => 30, 'sublocality' => 12, 'locality' => 5, 'administrative area level 2' => -10,
        ];
        $score = (float) ($typeWeights[$type] ?? 20);
        $haystack = $this->key(($candidate['name'] ?? '').' '.($candidate['label'] ?? ''));
        $rawKey = $this->key($raw);
        if ($rawKey !== '' && str_contains($haystack, $rawKey)) {
            $score += 35;
        }

        foreach (['barangay' => 24, 'city' => 22, 'province' => 14, 'region' => 8] as $field => $weight) {
            $needle = $this->key((string) ($context[$field] ?? ''));
            if ($needle !== '' && str_contains($haystack, $needle)) {
                $score += $weight;
            }
        }

        return round($score, 4);
    }

    private function normalizedQuery(string $raw, array $context): string
    {
        $parts = [$raw, $context['barangay'] ?? null, $context['city'] ?? null, $context['province'] ?? null, $context['region'] ?? null, 'Philippines'];
        $seen = [];
        $unique = [];
        foreach ($parts as $part) {
            $part = trim((string) ($part ?? ''));
            $key = $this->key($part);
            if ($part === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $unique[] = $part;
        }

        return implode(', ', $unique);
    }

    private function administrativelyCompatible(array $candidate, array $context): bool
    {
        $components = is_array($candidate['components'] ?? null) ? $candidate['components'] : [];
        $expectedCity = $this->placeKey((string) ($context['city'] ?? ''));
        $candidateCity = $this->placeKey((string) ($components['city'] ?? ''));
        $candidateDistrict = $this->placeKey((string) ($components['district'] ?? ''));

        if ($expectedCity !== '' && $candidateCity !== ''
            && $expectedCity !== $candidateCity
            && $expectedCity !== $candidateDistrict) {
            return false;
        }

        $expectedProvince = $this->placeKey((string) ($context['province'] ?? ''));
        if ($expectedProvince !== '') {
            $candidateAreas = array_filter([
                $this->placeKey((string) ($components['county'] ?? '')),
                $this->placeKey((string) ($components['state'] ?? '')),
            ]);
            if ($candidateAreas !== [] && ! in_array($expectedProvince, $candidateAreas, true)) {
                $label = $this->placeKey((string) ($candidate['label'] ?? ''));
                if (! preg_match('/\b'.preg_quote($expectedProvince, '/').'\b/', $label)) {
                    return false;
                }
            }
        }

        return true;
    }

    private function placeKey(string $value): string
    {
        $key = $this->key($value);
        $key = preg_replace('/\b(city of|municipality of|province of)\b/', '', $key) ?? $key;

        return trim(preg_replace('/\s+/', ' ', $key) ?? $key);
    }

    private function key(string $value): string
    {
        $value = Str::lower(Str::ascii(trim($value)));

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value);
    }
}
