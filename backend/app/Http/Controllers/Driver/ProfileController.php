<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Support\DriverAccount;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    /**
     * Authenticated driver may only view their own profile (derived from auth user).
     */
    public function show(Request $request)
    {
        $user   = $request->user();
        $driver = DriverAccount::require($user);

        $driver->load([
            'currentAssignment.jobOrder',
            'currentAssignment.vehicle',
            'user',
        ]);

        $currentAssignment = $this->resolveCurrentAssignment($driver);

        $vehicle = $currentAssignment?->vehicle
            ?? $driver->currentAssignment?->vehicle;

        $historyPage = max(1, (int) $request->query('history_page', 1));

        $history = DispatchAssignment::query()
            ->with(['jobOrder', 'vehicle'])
            ->withCount('deliveryStatusLogs')
            ->where('driver_id', $driver->id)
            ->whereIn('status', ['completed', 'cancelled'])
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->paginate(10, ['*'], 'history_page', $historyPage);

        return response()->json([
            'user' => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ],
            'driver' => [
                'id'                    => $driver->id,
                'license_no'            => $driver->license_no,
                'availability'          => $driver->availability,
                'current_assignment_id' => $driver->current_assignment_id,
            ],
            'vehicle' => $vehicle ? [
                'id'       => $vehicle->id,
                'plate_no' => $vehicle->plate_no,
                'type'     => $vehicle->type,
                'status'   => $vehicle->status,
            ] : null,
            'current_assignment' => $currentAssignment,
            'delivery_history'   => $history,
        ]);
    }

    private function resolveCurrentAssignment($driver): ?DispatchAssignment
    {
        $activeStatuses = ['assigned', 'in_progress', 'arrived'];

        if ($driver->current_assignment_id) {
            $linked = DispatchAssignment::query()
                ->with(['jobOrder', 'vehicle', 'deliveryStatusLogs'])
                ->where('id', $driver->current_assignment_id)
                ->where('driver_id', $driver->id)
                ->whereIn('status', $activeStatuses)
                ->first();

            if ($linked) {
                return $linked;
            }
        }

        return DispatchAssignment::query()
            ->with(['jobOrder', 'vehicle', 'deliveryStatusLogs'])
            ->where('driver_id', $driver->id)
            ->whereIn('status', $activeStatuses)
            ->latest('assigned_at')
            ->first();
    }
}
