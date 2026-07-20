<?php

namespace App\Services\Address;

use App\Services\Delivery\AddressGeocoder;
use App\Services\Geocoding\ConfirmedLocationService;
use App\Support\GpsCoordinateValidator;
use App\Support\JobOrderAddressFormatter;
use App\Support\StreetGeocodeHelper;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class StandardizedAddressService
{
    public function __construct(
        private PsgcClient $psgc,
        private AddressGeocoder $geocoder,
        private ConfirmedLocationService $confirmedLocations,
    ) {
    }

    /**
     * Validate PSGC ancestry, replace submitted labels with official names,
     * build the canonical address, and geocode it server-side.
     *
     * @return array<string, mixed>
     */
    public function normalize(
        array $data,
        string $prefix,
        bool $requireGeocode = true,
        bool $requireConfirmedCoordinates = false,
    ): array
    {
        $regionCode = trim((string) ($data["{$prefix}_region_code"] ?? ''));
        $provinceCode = trim((string) ($data["{$prefix}_province_code"] ?? '')) ?: null;
        $cityCode = trim((string) ($data["{$prefix}_city_code"] ?? ''));
        $barangayCode = trim((string) ($data["{$prefix}_barangay_code"] ?? ''));
        $street = mb_strtoupper(trim((string) ($data["{$prefix}_street"] ?? '')), 'UTF-8');

        $missing = [];
        foreach (['region_code' => $regionCode, 'city_code' => $cityCode, 'barangay_code' => $barangayCode, 'street' => $street] as $field => $value) {
            if ($value === '') {
                $missing["{$prefix}_{$field}"] = ['This address field is required.'];
            }
        }
        if ($missing !== []) {
            throw ValidationException::withMessages($missing);
        }

        try {
            $resolved = $this->psgc->resolveHierarchy($regionCode, $provinceCode, $cityCode, $barangayCode);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => [$exception->getMessage()],
            ]);
        }

        $region = mb_strtoupper(trim((string) $resolved['region']['name']), 'UTF-8');
        $province = isset($resolved['province']['name'])
            ? mb_strtoupper(trim((string) $resolved['province']['name']), 'UTF-8')
            : null;
        $city = mb_strtoupper(trim((string) $resolved['city']['name']), 'UTF-8');
        $barangay = mb_strtoupper(trim((string) $resolved['barangay']['name']), 'UTF-8');
        $formatted = $this->format($street, $barangay, $city, $province, $region);
        $confirmed = $this->confirmedLocations->fromPayload(
            $data,
            $prefix,
            $requireConfirmedCoordinates,
            $street,
        );
        $submitted = $this->submittedCoordinates($data, $prefix);
        $coordinates = $confirmed ?: $submitted ?: $this->geocoder->geocodeFirst(
            $this->geocodeCandidates($street, $barangay, $city, $province, $region, $formatted),
            [
                'city' => $city,
                'province' => $province,
                'region' => $region,
                'barangay' => $barangay,
                'region_code' => (string) ($resolved['region']['code'] ?? ''),
            ],
        );

        if (! $coordinates && $requireGeocode) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => ['The standardized address could not be geocoded. Check the street details or try again when the geocoding service is available.'],
            ]);
        }

        $googleFormatted = trim((string) (($confirmed['label'] ?? null) ?: ($coordinates['formatted_address'] ?? '')));
        $displayFormatted = $googleFormatted !== '' ? $googleFormatted : $formatted;

        $normalized = [
            "{$prefix}_region_code" => (string) $resolved['region']['code'],
            "{$prefix}_region" => $region,
            "{$prefix}_province_code" => $resolved['province']['code'] ?? null,
            "{$prefix}_province" => $province,
            "{$prefix}_city_code" => (string) $resolved['city']['code'],
            "{$prefix}_city" => $city,
            "{$prefix}_barangay_code" => (string) $resolved['barangay']['code'],
            "{$prefix}_barangay" => $barangay,
            "{$prefix}_street" => $street,
            "{$prefix}_formatted_address" => $displayFormatted,
            "{$prefix}_location" => $displayFormatted,
            "{$prefix}_latitude" => $coordinates['lat'] ?? null,
            "{$prefix}_longitude" => $coordinates['lng'] ?? null,
            "{$prefix}_geocode_attempted_at" => $coordinates ? now() : null,
        ];

        if ($confirmed) {
            $normalized = array_merge($normalized, [
                "{$prefix}_geocoding_trace_id" => $confirmed['trace_id'],
                "{$prefix}_coordinate_source" => $confirmed['source'],
                "{$prefix}_coordinate_provider" => $confirmed['provider'],
                "{$prefix}_coordinate_place_id" => $confirmed['place_id'],
                "{$prefix}_coordinate_label" => $confirmed['label'],
                "{$prefix}_coordinate_confirmed_at" => $confirmed['confirmed_at'],
            ]);
        } elseif ($submitted) {
            $normalized = array_merge($normalized, array_filter([
                "{$prefix}_geocoding_trace_id" => $data["{$prefix}_geocoding_trace_id"] ?? null,
                "{$prefix}_coordinate_source" => $data["{$prefix}_coordinate_source"] ?? 'autocomplete_selection',
                "{$prefix}_coordinate_provider" => $data["{$prefix}_coordinate_provider"] ?? null,
                "{$prefix}_coordinate_place_id" => $data["{$prefix}_coordinate_place_id"] ?? null,
                "{$prefix}_coordinate_label" => $data["{$prefix}_coordinate_label"] ?? null,
            ], static fn ($value): bool => $value !== null && $value !== ''));
        } elseif (is_array($coordinates) && ! empty($coordinates['place_id'])) {
            $normalized["{$prefix}_coordinate_place_id"] = $coordinates['place_id'];
            $normalized["{$prefix}_coordinate_provider"] = 'google_geocoding';
            $normalized["{$prefix}_coordinate_label"] = $coordinates['formatted_address'] ?? null;
        }

        return $normalized;
    }

    /** @return array<string, mixed> */
    public function normalizeEntityAddress(array $data): array
    {
        $normalized = $this->normalize($data, 'address');
        $normalized['address'] = $normalized['address_formatted_address'];
        unset($normalized['address_location'], $normalized['address_formatted_address']);

        return $normalized;
    }

    public function format(
        string $street,
        string $barangay,
        string $city,
        ?string $province,
        string $region,
    ): string {
        $barangayLine = preg_match('/^(barangay|brgy\.?\s)/i', $barangay)
            ? $barangay
            : 'Barangay '.$barangay;

        $parts = array_values(array_filter([
            $street,
            $barangayLine,
            $city,
            $province,
            $region,
            'Philippines',
        ], static fn ($value): bool => trim((string) $value) !== ''));

        $unique = [];
        foreach ($parts as $part) {
            $key = mb_strtolower(trim($part));
            if (! isset($unique[$key])) {
                $unique[$key] = mb_strtoupper(trim($part));
            }
        }

        return implode(', ', array_values($unique));
    }

    /**
     * @return list<string>
     */
    private function geocodeCandidates(
        string $street,
        string $barangay,
        string $city,
        ?string $province,
        string $region,
        string $formatted,
    ): array {
        $barangayLabel = preg_match('/^(barangay|brgy\.?\s)/i', $barangay)
            ? $barangay
            : 'Barangay '.$barangay;

        $streetVariants = StreetGeocodeHelper::geocodeStreetVariants($street);
        $candidates = [];

        foreach ($streetVariants as $streetVariant) {
            $candidates[] = $this->format($streetVariant, $barangay, $city, $province, $region);
            $candidates[] = JobOrderAddressFormatter::formatParts([$streetVariant, $barangayLabel, $city, $province, $region]);
            $candidates[] = JobOrderAddressFormatter::formatParts([$streetVariant, $barangay, $city, $province]);
        }

        return $this->uniqueNonEmpty(array_merge($candidates, [
            JobOrderAddressFormatter::formatParts([$barangayLabel, $city, $province, $region]),
            JobOrderAddressFormatter::formatParts([$barangay, $city, $province]),
            JobOrderAddressFormatter::formatParts([$city, $province, $region]),
            JobOrderAddressFormatter::formatParts([$city, $province]),
            $city.', '.$region.', Philippines',
            $city.', Philippines',
        ]));
    }

    /**
     * @param  list<string>  $values
     * @return list<string>
     */
    private function uniqueNonEmpty(array $values): array
    {
        $seen = [];
        $unique = [];

        foreach ($values as $value) {
            $value = trim($value);
            if ($value === '') {
                continue;
            }

            $key = mb_strtolower($value);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $unique[] = $value;
        }

        return $unique;
    }
    /** @return array{lat: float, lng: float, place_id?: string|null, formatted_address?: string|null}|null */
    private function submittedCoordinates(array $data, string $prefix): ?array
    {
        $pair = GpsCoordinateValidator::pair(
            $data["{$prefix}_latitude"] ?? null,
            $data["{$prefix}_longitude"] ?? null,
            "submitted_{$prefix}",
        );

        if (! $pair) {
            return null;
        }

        if (abs($pair['lat'] - 12.8797) < 0.0001 && abs($pair['lng'] - 121.774) < 0.0001) {
            return null;
        }

        return array_merge($pair, [
            'place_id' => $data["{$prefix}_coordinate_place_id"] ?? null,
            'formatted_address' => $data["{$prefix}_coordinate_label"] ?? null,
        ]);
    }

}
