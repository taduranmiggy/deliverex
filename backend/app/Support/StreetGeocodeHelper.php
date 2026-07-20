<?php

namespace App\Support;

/**
 * Normalizes Filipino street abbreviations for geocoding and rejects fuzzy
 * substring matches (e.g. "Pares" when the query is "P. Paredes St.").
 */
final class StreetGeocodeHelper
{
    /**
     * Expand common street abbreviations so geocoders receive unambiguous queries.
     */
    public static function expandForGeocode(string $street): string
    {
        $street = trim($street);
        if ($street === '') {
            return '';
        }

        // 865 P. Paredes St. → 865 Paredes Street
        $expanded = preg_replace(
            '/^(\d+\s+)?P\.\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\']*)\.?(?:\s+(ST\.?|STREET))?/iu',
            '$1$2 Street',
            $street,
        );

        return trim((string) ($expanded ?? $street));
    }

    /**
     * @return list<string>
     */
    public static function geocodeStreetVariants(string $street): array
    {
        $street = trim($street);
        if ($street === '') {
            return [];
        }

        $expanded = self::expandForGeocode($street);
        $variants = [$street];

        if ($expanded !== '' && ! self::sameStreet($street, $expanded)) {
            $variants[] = $expanded;
        }

        $withoutNumber = preg_replace('/^\d+\s+/', '', $expanded) ?? $expanded;
        $withoutNumber = trim($withoutNumber);
        if ($withoutNumber !== '' && ! self::sameStreet($withoutNumber, $expanded)) {
            $variants[] = $withoutNumber;
        }

        return self::uniqueNonEmpty($variants);
    }

    /**
     * @return list<string>
     */
    public static function expectedStreetTokens(string $query): array
    {
        $expanded = self::expandForGeocode(self::extractStreetSegment($query));
        $normalized = self::normalizeStreetName($expanded);
        if ($normalized === '') {
            return [];
        }

        $tokens = [$normalized];

        foreach (preg_split('/\s+/', $normalized) ?: [] as $part) {
            $part = trim($part);
            if ($part === '' || in_array($part, ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'drive', 'dr'], true)) {
                continue;
            }

            if (mb_strlen($part) >= 4) {
                $tokens[] = $part;
            }
        }

        return array_values(array_unique($tokens));
    }

    /** @param  list<string>  $labels */
    public static function resultConflictsWithQuery(string $query, array $labels): bool
    {
        if (! self::queryLooksLikeStreetAddress($query)) {
            return false;
        }

        $expectedTokens = self::expectedStreetTokens($query);
        if ($expectedTokens === []) {
            return false;
        }

        $resultStreet = self::extractResultStreetName($labels);
        if ($resultStreet === '') {
            return false;
        }

        foreach ($expectedTokens as $expected) {
            if (self::isPrefixMismatch($expected, $resultStreet)) {
                return true;
            }
        }

        return false;
    }

    public static function queryLooksLikeStreetAddress(string $query): bool
    {
        $street = self::extractStreetSegment($query);
        if ($street === '') {
            return false;
        }

        if (preg_match('/^\d+\s+/', $street) === 1) {
            return true;
        }

        if (preg_match('/\bP\.\s+[A-Za-zÀ-ÿ]/iu', $street) === 1) {
            return true;
        }

        return preg_match('/\b(ST\.?|STREET|ROAD|RD\.?|AVENUE|AVE\.?|DRIVE|DR\.?|BLVD\.?|BOULEVARD|HWY\.?|HIGHWAY)\b/iu', $street) === 1;
    }

    /**
     * @param  list<string>  $labels
     */
    public static function extractResultStreetName(array $labels): string
    {
        foreach ($labels as $label) {
            $label = trim($label);
            if ($label === '') {
                continue;
            }

            if (preg_match('/^(.+?)\s+(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?)$/iu', $label, $matches) === 1) {
                $name = self::normalizeStreetName($matches[1]);
                if ($name !== '') {
                    return $name;
                }
            }
        }

        foreach ($labels as $label) {
            $normalized = self::normalizeStreetName($label);
            if ($normalized !== '' && mb_strlen($normalized) <= 40) {
                return $normalized;
            }
        }

        return '';
    }

    private static function extractStreetSegment(string $query): string
    {
        $segment = trim(explode(',', $query)[0] ?? $query);

        return trim($segment);
    }

    private static function normalizeStreetName(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = preg_replace('/^\d+\s+/', '', $value) ?? $value;
        $value = preg_replace('/\b(street|st|road|rd|avenue|ave|drive|dr|boulevard|blvd|highway|hwy)\b\.?/iu', ' ', $value) ?? $value;
        $value = preg_replace('/[^a-z0-9\s]/', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        return trim($value);
    }

    private static function isPrefixMismatch(string $expected, string $actual): bool
    {
        if ($expected === '' || $actual === '' || $expected === $actual) {
            return false;
        }

        if (mb_strlen($expected) < 4 || mb_strlen($actual) < 4) {
            return false;
        }

        if (str_starts_with($expected, $actual) && mb_strlen($expected) - mb_strlen($actual) >= 2) {
            return true;
        }

        if (str_starts_with($actual, $expected) && mb_strlen($actual) - mb_strlen($expected) >= 2) {
            return true;
        }

        $distance = levenshtein($expected, $actual);
        if ($distance > 0 && $distance <= 2) {
            similar_text($expected, $actual, $percent);

            return $percent >= 70.0;
        }

        return false;
    }

    private static function sameStreet(string $a, string $b): bool
    {
        return self::normalizeStreetName($a) === self::normalizeStreetName($b);
    }

    /**
     * @param  list<string>  $values
     * @return list<string>
     */
    private static function uniqueNonEmpty(array $values): array
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
