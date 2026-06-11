<?php

namespace App\Support;

use App\Models\Driver;
use App\Models\User;

class DriverAccount
{
    /**
     * Ensure a drivers-table row exists for a user with the driver role,
     * and keep the profile fields in sync with the users table.
     *
     * What it does:
     *  - Creates the driver record if one doesn't exist yet.
     *  - Copies user.name → full_name when the driver row is auto-generated
     *    (license_no starts with 'PENDING-') or when full_name is still null.
     *  - Sets sensible defaults (status, availability) so the driver immediately
     *    appears on dispatcher and Best-Fit screens without manual intervention.
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

        if (!$driver) {
            // First time: create a complete profile
            $driver = Driver::query()->create([
                'user_id'      => $user->id,
                'full_name'    => $user->name,
                'license_no'   => 'PENDING-' . $user->id,
                'availability' => 'available',
                'status'       => 'available',
            ]);
        } else {
            // Sync name changes and patch missing fields on auto-generated rows
            $needsUpdate = false;
            $patch = [];

            if (empty($driver->full_name)) {
                $patch['full_name'] = $user->name;
                $needsUpdate = true;
            }

            // status defaults to 'available' if it was never set
            if (empty($driver->status)) {
                $patch['status'] = 'available';
                $needsUpdate = true;
            }

            // availability defaults to 'available' if it was never set
            if (empty($driver->availability)) {
                $patch['availability'] = 'available';
                $needsUpdate = true;
            }

            if ($needsUpdate) {
                $driver->update($patch);
                $driver->refresh();
            }
        }

        return $driver;
    }

    /**
     * Sync the driver profile whenever the linked user account is updated.
     *
     * Called by UserController::update() so that:
     *  - Changing a user's role to 'driver' immediately creates the driver record.
     *  - Updating a user's name is reflected in drivers.full_name (only for
     *    auto-generated rows whose license_no starts with 'PENDING-').
     */
    public static function sync(User $user): ?Driver
    {
        $user->loadMissing('role');

        if ($user->role?->name !== 'driver') {
            return null;
        }

        $driver = self::resolve($user);

        // Keep full_name in sync for auto-provisioned profiles
        if ($driver && str_starts_with($driver->license_no ?? '', 'PENDING-')) {
            if ($driver->full_name !== $user->name) {
                $driver->update(['full_name' => $user->name]);
                $driver->refresh();
            }
        }

        return $driver;
    }

    /**
     * Like resolve() but aborts with 403 if no driver profile can be created.
     * Used by driver-app controllers.
     */
    public static function require(User $user): Driver
    {
        $driver = self::resolve($user);

        if (!$driver) {
            abort(403, 'Driver profile not available for this account.');
        }

        return $driver;
    }
}
