<?php

namespace App\Services\Address;

use App\Services\Delivery\AddressGeocoder;
use App\Support\JobOrderAddressFormatter;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class StandardizedAddressService
{
    public function __construct(
        private PsgcClient $psgc,
        private AddressGeocoder $geocoder,
    ) {
    }

    /**
     * Validate PSGC ancestry, replace submitted labels with official names,
     * build the canonical address, and geocode it server-side.
     *
     * @return array<string, mixed>
     */
    public function normalize(array $data, string $prefix): array
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
        $coordinates = $this->geocoder->geocodeFirst(
            $this->geocodeCandidates($street, $barangay, $city, $province, $region, $formatted),
        );

        if (! $coordinates) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => ['The standardized address could not be geocoded. Check the street details or try again when the geocoding service is available.'],
            ]);
        }

        return [
            "{$prefix}_region_code" => (string) $resolved['region']['code'],
            "{$prefix}_region" => $region,
            "{$prefix}_province_code" => $resolved['province']['code'] ?? null,
            "{$prefix}_province" => $province,
            "{$prefix}_city_code" => (string) $resolved['city']['code'],
            "{$prefix}_city" => $city,
            "{$prefix}_barangay_code" => (string) $resolved['barangay']['code'],
            "{$prefix}_barangay" => $barangay,
            "{$prefix}_street" => $street,
            "{$prefix}_formatted_address" => $formatted,
            "{$prefix}_location" => $formatted,
            "{$prefix}_latitude" => $coordinates['lat'],
            "{$prefix}_longitude" => $coordinates['lng'],
            "{$prefix}_geocode_attempted_at" => now(),
        ];
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

        return $this->uniqueNonEmpty([
            $formatted,
            JobOrderAddressFormatter::formatParts([$street, $barangayLabel, $city, $province, $region]),
            JobOrderAddressFormatter::formatParts([$street, $barangay, $city, $province]),
            JobOrderAddressFormatter::formatParts([$barangayLabel, $city, $province, $region]),
            JobOrderAddressFormatter::formatParts([$barangay, $city, $province]),
            JobOrderAddressFormatter::formatParts([$city, $province, $region]),
            JobOrderAddressFormatter::formatParts([$city, $province]),
            $city.', '.$region.', Philippines',
            $city.', Philippines',
        ]);
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
}
