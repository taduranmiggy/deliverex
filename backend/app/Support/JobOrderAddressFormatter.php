<?php

namespace App\Support;

/**
 * Canonical formatting and parsing for job-order pickup/dropoff addresses.
 * Prevents duplicate segments when structured parts repeat the same value.
 */
final class JobOrderAddressFormatter
{
    /**
     * Join address parts for display/storage, removing duplicate segments.
     *
     * @param  list<string|null>  $parts
     */
    public static function formatParts(array $parts): string
    {
        $cleaned = [];
        foreach ($parts as $part) {
            $value = trim((string) ($part ?? ''));
            if ($value === '') {
                continue;
            }
            if (in_array($value, $cleaned, true)) {
                continue;
            }
            $cleaned[] = $value;
        }

        return implode(', ', $cleaned);
    }

    /**
     * Map a single user-entered address line into structured fields without
     * copying the same value into multiple columns.
     *
     * @return array{street:string,barangay:string,city:string,province:string}
     */
    public static function parseLine(string $line): array
    {
        $trimmed = trim($line);
        if ($trimmed === '') {
            return self::emptyParts();
        }

        $segments = self::dedupeSegments(
            array_values(array_filter(array_map('trim', explode(',', $trimmed)), fn ($p) => $p !== ''))
        );

        if (count($segments) >= 4) {
            return [
                'street'   => implode(', ', array_slice($segments, 0, -3)),
                'barangay' => $segments[count($segments) - 3],
                'city'     => $segments[count($segments) - 2],
                'province' => $segments[count($segments) - 1],
            ];
        }

        if (count($segments) === 3) {
            return [
                'street'   => $segments[0],
                'barangay' => $segments[1],
                'city'     => $segments[2],
                'province' => '',
            ];
        }

        if (count($segments) === 2) {
            return [
                'street'   => $segments[0],
                'barangay' => '',
                'city'     => $segments[1],
                'province' => '',
            ];
        }

        return [
            'street'   => $segments[0],
            'barangay' => '',
            'city'     => '',
            'province' => '',
        ];
    }

    /**
     * Build display string from structured columns, falling back to legacy location.
     */
    public static function displayFromStructured(
        ?string $street,
        ?string $barangay,
        ?string $city,
        ?string $province,
        ?string $legacyLocation = null,
    ): string {
        if (trim((string) $street) !== '' || trim((string) $city) !== '') {
            return self::formatParts([$street, $barangay, $city, $province]);
        }

        return trim((string) ($legacyLocation ?? ''));
    }

    /**
     * Repair structured columns corrupted by repeated identical values.
     *
     * @return array{street:?string,barangay:?string,city:?string,province:?string,location:string}
     */
    public static function repairStructured(
        ?string $street,
        ?string $barangay,
        ?string $city,
        ?string $province,
        ?string $legacyLocation = null,
    ): array {
        $parts = array_map(fn ($p) => trim((string) ($p ?? '')), [$street, $barangay, $city, $province]);
        $nonEmpty = array_values(array_filter($parts, fn ($p) => $p !== ''));

        if ($nonEmpty === []) {
            $location = trim((string) ($legacyLocation ?? ''));

            return [
                'street'   => null,
                'barangay' => null,
                'city'     => null,
                'province' => null,
                'location' => $location,
            ];
        }

        $unique = self::dedupeSegments($nonEmpty);

        if (count($unique) === 1) {
            $only = $unique[0];

            return [
                'street'   => $only,
                'barangay' => null,
                'city'     => null,
                'province' => null,
                'location' => $only,
            ];
        }

        $parsed = self::parseLine(implode(', ', $unique));

        return [
            'street'   => $parsed['street'] ?: null,
            'barangay' => $parsed['barangay'] ?: null,
            'city'     => $parsed['city'] ?: null,
            'province' => $parsed['province'] ?: null,
            'location' => self::formatParts([
                $parsed['street'],
                $parsed['barangay'],
                $parsed['city'],
                $parsed['province'],
            ]),
        ];
    }

    /** @return array{street:string,barangay:string,city:string,province:string} */
    private static function emptyParts(): array
    {
        return ['street' => '', 'barangay' => '', 'city' => '', 'province' => ''];
    }

    /**
     * @param  list<string>  $segments
     * @return list<string>
     */
    private static function dedupeSegments(array $segments): array
    {
        $unique = [];
        foreach ($segments as $segment) {
            if (! in_array($segment, $unique, true)) {
                $unique[] = $segment;
            }
        }

        return $unique;
    }
}
