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

        $baseQuery = DispatchAssignment::query()->where('driver_id', $driver->id);
        $stats = [
            'total_deliveries'     => (clone $baseQuery)->count(),
            'completed_deliveries' => (clone $baseQuery)->where('status', 'completed')->count(),
            'pending_deliveries'   => (clone $baseQuery)->whereIn('status', ['assigned', 'in_progress', 'arrived'])->count(),
        ];

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
            'stats'              => $stats,
        ]);
    }

    /**
     * Driver may update limited profile fields on their own account.
     */
    public function update(Request $request)
    {
        $user = $request->user();
        DriverAccount::require($user);

        $data = $request->validate([
            'phone' => ['nullable', 'string', 'max:50'],
            'name'  => ['sometimes', 'string', 'max:255'],
        ]);

        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }
        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }
        $user->save();

        return response()->json([
            'user' => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ],
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
