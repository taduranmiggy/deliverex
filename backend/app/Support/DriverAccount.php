<?php

namespace App\Support;

use App\Models\Driver;
use App\Models\User;
use App\Services\Driver\DriverAvailabilityService;
use Illuminate\Support\Str;

class DriverAccount
{
    /**
     * Temporary password for admin-generated driver accounts (e.g. DRV-8KX29P).
     */
    public static function generateTemporaryPassword(): string
    {
        return 'DRV-'.strtoupper(Str::random(6));
    }

    /**
     * Ensure a drivers-table row exists for a user with the driver role,
     * and keep the profile fields in sync with the users table.
     *
     * Returns null for non-driver users.
     */
    public static function resolve(User $user): ?Driver
    {
        $user->loadMissing('role');

        if ($user->role?->name !== 'driver') {
            return null;
        }

        $driver = $user->driver;

        if (! $driver) {
            $linked = Driver::query()->where('user_id', $user->id)->first();
            if ($linked) {
                return $linked;
            }

            $driver = Driver::query()->create([
                'user_id'      => $user->id,
                'full_name'    => $user->name,
                'license_no'   => 'PENDING-'.$user->id,
                'availability' => 'available',
                'status'       => 'available',
            ]);
        } else {
            $needsUpdate = false;
            $patch = [];

            if (empty($driver->full_name)) {
                $patch['full_name'] = $user->name;
                $needsUpdate = true;
            }

            if (empty($driver->status)) {
                $patch['status'] = 'available';
                $needsUpdate = true;
            }

            if (empty($driver->availability)) {
                $patch['availability'] = 'available';
                $needsUpdate = true;
            }

            if ($needsUpdate) {
                $driver->update($patch);
                $driver->refresh();
            }
        }

        app(DriverAvailabilityService::class)->sync($driver, 'driver_login_provision');

        return $driver;
    }

    public static function sync(User $user): ?Driver
    {
        $user->loadMissing('role');

        if ($user->role?->name !== 'driver') {
            return null;
        }

        $driver = self::resolve($user);

        if ($driver && str_starts_with($driver->license_no ?? '', 'PENDING-')) {
            if ($driver->full_name !== $user->name) {
                $driver->update(['full_name' => $user->name]);
                $driver->refresh();
            }
        }

        return $driver;
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
