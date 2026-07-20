<?php

namespace App\Support;

final class PhilippineDriverLicenseGenerator
{
    /** LTO LTMS card pattern, e.g. N03-24-014123 */
    public const FORMAT_PATTERN = '/^[A-Z]\d{2}-\d{2}-\d{6}$/';

    /**
     * @param  list<string>  $reserved  License numbers already taken (case-insensitive).
     */
    public static function generateForDriver(int $driverId, array $reserved = []): string
    {
        $reservedKeys = [];
        foreach ($reserved as $value) {
            $key = self::normalizeKey($value);
            if ($key !== '') {
                $reservedKeys[$key] = true;
            }
        }

        for ($try = 0; $try < 200; $try++) {
            $license = self::build($driverId, $try);
            if (! isset($reservedKeys[self::normalizeKey($license)])) {
                return $license;
            }
        }

        // Extremely unlikely fallback — still valid format.
        return self::build($driverId + time(), 0);
    }

    public static function isMissingOrPlaceholder(?string $licenseNo): bool
    {
        $value = trim((string) ($licenseNo ?? ''));
        if ($value === '') {
            return true;
        }

        return str_starts_with(strtoupper($value), 'PENDING-');
    }

    public static function isPhilippineFormat(?string $licenseNo): bool
    {
        $value = strtoupper(trim((string) ($licenseNo ?? '')));

        return $value !== '' && preg_match(self::FORMAT_PATTERN, $value) === 1;
    }

    private static function build(int $driverId, int $try): string
    {
        // N + 2-digit LTO district/office code (01–99), 2-digit issuance year, 6-digit serial.
        $office = str_pad((string) ((($driverId + $try) % 98) + 1), 2, '0', STR_PAD_LEFT);
        $year = now()->format('y');
        $serial = str_pad(
            (string) ((($driverId * 1009) + ($try * 137) + 123_456) % 1_000_000),
            6,
            '0',
            STR_PAD_LEFT,
        );

        return "N{$office}-{$year}-{$serial}";
    }

    private static function normalizeKey(?string $licenseNo): string
    {
        return strtoupper(trim((string) ($licenseNo ?? '')));
    }
}
