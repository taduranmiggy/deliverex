<?php

use App\Models\DispatchAssignment;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
| Channel auth runs through the auth.api middleware (JWT bearer), so $user
| is the authenticated User model with its role relation available.
*/

// Fleet-wide live GPS feed for the web panel (dispatcher tracking map).
Broadcast::channel('fleet.live', function ($user) {
    return in_array($user->role?->name, ['admin', 'dispatcher', 'manager'], true);
});

// Per-trip GPS feed — staff, or the driver assigned to the trip.
Broadcast::channel('trip.{assignmentId}', function ($user, int $assignmentId) {
    if (in_array($user->role?->name, ['admin', 'dispatcher', 'manager'], true)) {
        return true;
    }

    if ($user->role?->name === 'driver') {
        $driverId = $user->driver?->id;

        return $driverId !== null && DispatchAssignment::query()
            ->whereKey($assignmentId)
            ->where('driver_id', $driverId)
            ->exists();
    }

    return false;
});
