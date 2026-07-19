<?php

namespace App\Services\Address;

use App\Services\Delivery\AddressGeocoder;
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
        $street = trim((string) ($data["{$prefix}_street"] ?? ''));

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

        $region = trim((string) $resolved['region']['name']);
        $province = isset($resolved['province']['name'])
            ? trim((string) $resolved['province']['name'])
            : null;
        $city = trim((string) $resolved['city']['name']);
        $barangay = trim((string) $resolved['barangay']['name']);
        $formatted = $this->format($street, $barangay, $city, $province, $region);
        $coordinates = $this->geocoder->geocode($formatted);

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
}
