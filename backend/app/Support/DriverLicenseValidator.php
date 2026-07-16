<?php

namespace App\Support;

use App\Models\Driver;
use Carbon\Carbon;

class DriverLicenseValidator
{
    public const STATUS_VALID = 'valid';

    public const STATUS_MISSING = 'missing';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_INCOMPLETE = 'incomplete';

    public const INELIGIBILITY_MESSAGE = "This driver cannot be assigned because the driver's license information is incomplete or expired.";

    public static function licenseNumber(Driver $driver): ?string
    {
        $value = trim((string) ($driver->license_no ?? ''));

        return $value !== '' ? $value : null;
    }

    public static function status(Driver $driver): string
    {
        if (! self::licenseNumber($driver)) {
            return self::STATUS_MISSING;
        }

        if (! $driver->license_expiry) {
            return self::STATUS_INCOMPLETE;
        }

        $expiry = $driver->license_expiry instanceof Carbon
            ? $driver->license_expiry
            : Carbon::parse($driver->license_expiry);

        if ($expiry->isPast()) {
            return self::STATUS_EXPIRED;
        }

        return self::STATUS_VALID;
    }

    public static function isEligible(Driver $driver): bool
    {
        return self::status($driver) === self::STATUS_VALID;
    }

    /** @return array{eligible:bool,license_status:string,license_no:?string,license_expiry:?string,message:?string} */
    public static function summary(Driver $driver): array
    {
        $licenseStatus = self::status($driver);

        return [
            'eligible'        => $licenseStatus === self::STATUS_VALID,
            'license_status'  => $licenseStatus,
            'license_no'      => self::licenseNumber($driver),
            'license_expiry'  => $driver->license_expiry?->toDateString(),
            'message'         => $licenseStatus === self::STATUS_VALID ? null : self::INELIGIBILITY_MESSAGE,
        ];
    }
}
