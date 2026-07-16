<?php

namespace App\Support;

class CompanyAddressHelper
{
    /**
     * @param  array<string, mixed>  $parts
     * @return array<string, mixed>
     */
    public static function normalizeStructured(array $parts): array
    {
        $street = trim((string) ($parts['street'] ?? $parts['address_street'] ?? ''));
        $barangay = trim((string) ($parts['barangay'] ?? $parts['address_barangay'] ?? ''));
        $city = trim((string) ($parts['city'] ?? $parts['address_city'] ?? ''));
        $province = trim((string) ($parts['province'] ?? $parts['address_province'] ?? ''));

        return [
            'address_street' => $street !== '' ? $street : null,
            'address_barangay' => $barangay !== '' ? $barangay : null,
            'address_city' => $city !== '' ? $city : null,
            'address_province' => $province !== '' ? $province : null,
            'address' => JobOrderAddressFormatter::formatParts([$street, $barangay, $city, $province]) ?: null,
        ];
    }

    public static function hasStructuredAddress(?object $company): bool
    {
        if (! $company) {
            return false;
        }

        return ! empty($company->address_street)
            || ! empty($company->address_barangay)
            || ! empty($company->address_city)
            || ! empty($company->address_province);
    }
}
