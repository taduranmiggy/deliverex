<?php

namespace App\Services\Geocoding;

use App\Models\GeocodingTrace;
use App\Models\User;
use App\Support\GpsCoordinateValidator;
use App\Support\OpenRouteServiceAuth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class LocationAutocompleteService
{
    /** @return array{trace: GeocodingTrace, candidates: list<array<string, mixed>>} */
    public function search(array $input, ?User $user): array
    {
        $raw = trim((string) ($input['query'] ?? ''));
        $normalized = $this->normalizedQuery($raw, $input);
        if (mb_strlen($raw) < 3) {
            throw new RuntimeException('Type at least 3 characters to search for a precise place.');
        }

        $attempts = [];
        $providerUsed = null;
        $requestUrl = null;
        $requestPayload = null;
        $responsePayload = null;
        $candidates = [];
        $allCandidates = [];

        foreach ((array) config('gps.geocoding.autocomplete_providers', ['geoapify', 'openrouteservice', 'photon']) as $provider) {
            try {
                $result = $this->requestProvider((string) $provider, $normalized);
                if ($result === null) {
                    continue;
                }

                $attempts[] = [
                    'provider' => $provider,
                    'status' => $result['status'],
                    'cached' => $result['cached'],
                    'response' => $result['response'],
                ];

                if ($result['status'] >= 200 && $result['status'] < 300) {
                    $providerUsed = (string) $provider;
                    $requestUrl = $result['url'];
                    $requestPayload = $result['params'];
                    $responsePayload = $result['response'];
                    $parsed = $this->parseCandidates($providerUsed, $responsePayload, $raw, $input);
                    $candidates = $parsed['eligible'];
                    $allCandidates = $parsed['all'];
                    if ($candidates !== []) {
                        break;
                    }
                }
            } catch (\Throwable $exception) {
                $attempts[] = [
                    'provider' => $provider,
                    'status' => 'failed',
                    'error' => $exception->getMessage(),
                ];
            }
        }

        $trace = GeocodingTrace::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user?->id,
            'context' => trim((string) ($input['context'] ?? 'address')) ?: 'address',
            'raw_input' => $raw,
            'normalized_address' => $normalized,
            'provider' => $providerUsed,
            'request_url' => $requestUrl,
            'request_payload' => $requestPayload,
            'response_payload' => [
                'selected_provider_response' => $responsePayload,
                'provider_attempts' => $attempts,
            ],
            'candidates' => $allCandidates,
            'status' => $candidates === [] ? 'no_results' : 'searched',
            'error_message' => $providerUsed === null
                ? 'No configured autocomplete provider returned a usable response.'
                : null,
        ]);

        if ($providerUsed === null && $attempts === []) {
            throw new RuntimeException('No address autocomplete provider is configured. Add a Geoapify or OpenRouteService API key.');
        }

        return ['trace' => $trace, 'candidates' => $candidates];
    }

    /** @return array<string, mixed>|null */
    private function requestProvider(string $provider, string $query): ?array
    {
        $provider = strtolower($provider);
        $params = [];
        $headers = ['User-Agent' => config('gps.geocoding.user_agent', 'Deliverex/1.0')];

        if ($provider === 'geoapify') {
            $key = trim((string) config('gps.geocoding.geoapify_api_key'));
            if ($key === '') {
                return null;
            }
            $url = (string) config('gps.geocoding.geoapify_autocomplete_url');
            $params = [
                'text' => $query,
                'format' => 'json',
                'filter' => 'countrycode:ph',
                'limit' => 8,
                'lang' => 'en',
                'apiKey' => $key,
            ];
        } elseif ($provider === 'openrouteservice') {
            $key = trim((string) config('gps.routing.openrouteservice_api_key'));
            if ($key === '') {
                return null;
            }
            $url = (string) config('gps.geocoding.openrouteservice_autocomplete_url');
            $params = [
                'text' => $query,
                'size' => 8,
                'boundary.country' => 'PH',
            ];
            $headers = array_merge($headers, OpenRouteServiceAuth::authorizationHeader($key) ?? []);
        } elseif ($provider === 'photon') {
            $url = trim((string) config('gps.geocoding.photon_url'));
            if ($url === '') {
                return null;
            }
            $params = [
                'q' => $query,
                'limit' => 8,
                'lang' => 'en',
                'countrycode' => 'PH',
                'bbox' => '116.0,4.5,127.5,21.5',
            ];
        } else {
            return null;
        }

        $safeParams = $params;
        unset($safeParams['apiKey']);
        $cacheKey = 'deliverex.autocomplete.v1.'.hash('sha256', $provider.'|'.json_encode($safeParams));
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return [
                'url' => $url,
                'params' => $safeParams,
                'status' => 200,
                'response' => $cached,
                'cached' => true,
            ];
        }

        $response = Http::timeout(12)->withHeaders($headers)->get($url, $params);
        $payload = $response->json();
        $payload = is_array($payload) ? $payload : ['raw_body' => mb_substr($response->body(), 0, 20000)];
        if ($response->successful()) {
            Cache::put($cacheKey, $payload, now()->addMinutes(15));
        }

        return [
            'url' => $url,
            'params' => $safeParams,
            'status' => $response->status(),
            'response' => $payload,
            'cached' => false,
        ];
    }

    /** @return array{eligible: list<array<string, mixed>>, all: list<array<string, mixed>>} */
    private function parseCandidates(string $provider, array $payload, string $raw, array $context): array
    {
        $rows = match ($provider) {
            'geoapify' => $payload['results'] ?? [],
            'openrouteservice', 'photon' => $payload['features'] ?? [],
            default => [],
        };
        if (! is_array($rows)) {
            return ['eligible' => [], 'all' => []];
        }

        $candidates = [];
        $allCandidates = [];
        foreach ($rows as $index => $row) {
            if (! is_array($row)) {
                continue;
            }

            $candidate = match ($provider) {
                'geoapify' => $this->geoapifyCandidate($row),
                'openrouteservice' => $this->geoJsonCandidate($row, 'openrouteservice'),
                'photon' => $this->geoJsonCandidate($row, 'photon'),
                default => null,
            };
            if (! $candidate) {
                continue;
            }

            $pair = GpsCoordinateValidator::pair($candidate['lat'], $candidate['lng'], 'autocomplete_'.$provider);
            if (! $pair) {
                continue;
            }
            $candidate['lat'] = $pair['lat'];
            $candidate['lng'] = $pair['lng'];
            $candidate['id'] = substr(hash('sha256', implode('|', [
                $provider,
                $candidate['place_id'] ?? '',
                $candidate['label'],
                $candidate['lat'],
                $candidate['lng'],
                $index,
            ])), 0, 24);
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
    private function geoapifyCandidate(array $row): ?array
    {
        if (! isset($row['lat'], $row['lon'])) {
            return null;
        }
        $rank = is_array($row['rank'] ?? null) ? $row['rank'] : [];

        return [
            'provider' => 'geoapify',
            'place_id' => $row['place_id'] ?? null,
            'name' => $row['name'] ?? $row['address_line1'] ?? $row['formatted'] ?? '',
            'label' => $row['formatted'] ?? $row['address_line1'] ?? '',
            'lat' => (float) $row['lat'],
            'lng' => (float) $row['lon'],
            'type' => $row['result_type'] ?? $row['category'] ?? 'unknown',
            'confidence' => isset($rank['confidence']) ? (float) $rank['confidence'] : null,
            'components' => $this->onlyComponents($row),
        ];
    }

    /** @return array<string, mixed>|null */
    private function geoJsonCandidate(array $feature, string $provider): ?array
    {
        $coordinates = $feature['geometry']['coordinates'] ?? null;
        if (! is_array($coordinates) || count($coordinates) < 2) {
            return null;
        }
        $properties = is_array($feature['properties'] ?? null) ? $feature['properties'] : [];

        return [
            'provider' => $provider,
            'place_id' => $properties['id'] ?? $properties['gid'] ?? $properties['osm_id'] ?? null,
            'name' => $properties['name'] ?? $properties['street'] ?? $properties['label'] ?? '',
            'label' => $properties['label'] ?? $this->componentLabel($properties),
            'lat' => (float) $coordinates[1],
            'lng' => (float) $coordinates[0],
            'type' => $properties['layer'] ?? $properties['type'] ?? $properties['osm_value'] ?? 'unknown',
            'confidence' => isset($properties['confidence']) ? (float) $properties['confidence'] : null,
            'components' => $this->onlyComponents($properties),
        ];
    }

    /** @return array<string, mixed> */
    private function onlyComponents(array $row): array
    {
        return array_filter([
            'housenumber' => $row['housenumber'] ?? $row['house_number'] ?? null,
            'street' => $row['street'] ?? $row['road'] ?? null,
            'district' => $row['district'] ?? $row['suburb'] ?? $row['localadmin'] ?? null,
            'city' => $row['city'] ?? $row['locality'] ?? null,
            'county' => $row['county'] ?? null,
            'state' => $row['state'] ?? $row['region'] ?? null,
            'country' => $row['country'] ?? null,
            'country_code' => $row['country_code'] ?? $row['countrycode'] ?? null,
        ], static fn ($value): bool => $value !== null && $value !== '');
    }

    private function componentLabel(array $properties): string
    {
        return implode(', ', array_values(array_unique(array_filter([
            $properties['name'] ?? null,
            $properties['street'] ?? null,
            $properties['district'] ?? $properties['localadmin'] ?? null,
            $properties['city'] ?? $properties['locality'] ?? null,
            $properties['county'] ?? null,
            $properties['state'] ?? $properties['region'] ?? null,
            $properties['country'] ?? 'Philippines',
        ]))));
    }

    private function score(array $candidate, string $raw, array $context): float
    {
        $typeWeights = [
            'building' => 55, 'house' => 55, 'address' => 52, 'venue' => 50,
            'amenity' => 48, 'street' => 38, 'other' => 30, 'district' => 12,
            'locality' => 5, 'city' => 0, 'county' => -10, 'state' => -20,
        ];
        $type = strtolower((string) ($candidate['type'] ?? 'unknown'));
        $score = (float) ($typeWeights[$type] ?? 20);
        $score += ((float) ($candidate['confidence'] ?? 0.5)) * 40;
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
