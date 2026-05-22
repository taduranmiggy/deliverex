<?php

namespace App\Support;

use App\Models\Driver;
use App\Models\User;

class DriverAccount
{
    /**
     * Ensure a drivers-table row exists for a user with the driver role.
     */
    public static function resolve(User $user): ?Driver
    {
        $user->loadMissing('role');

        if ($user->role?->name !== 'driver') {
            return null;
        }

        $existing = $user->driver;
        if ($existing) {
            return $existing;
        }

        return Driver::query()->create([
            'user_id'      => $user->id,
            'license_no'   => 'PENDING-' . $user->id,
            'availability' => 'available',
        ]);
    }

    public static function require(User $user): Driver
    {
        $driver = self::resolve($user);

        if (! $driver) {
            abort(403, 'Driver profile not available for this account.');
        }

        return $driver;
    }
}
