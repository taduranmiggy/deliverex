<?php

namespace App\Http\Controllers;

use App\Models\JobOrder;
use App\Services\Delivery\JobOrderLocationService;
use App\Support\DriverAccount;

class JobOrderMapController extends Controller
{
    public function __construct(private JobOrderLocationService $locationService)
    {
    }

    public function show(JobOrder $jobOrder)
    {
        $user = request()->user();

        if ($user?->role?->name === 'driver') {
            $driver = DriverAccount::resolve($user);
            $assigned = $driver && $jobOrder->assignments()
                ->where('driver_id', $driver->id)
                ->exists();

            if (! $assigned) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        return response()->json([
            'data' => $this->locationService->mapPayload($jobOrder),
        ]);
    }
}
