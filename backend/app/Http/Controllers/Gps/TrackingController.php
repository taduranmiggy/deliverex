<?php

namespace App\Http\Controllers\Gps;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Services\Gps\DriverLocationService;
use App\Services\Gps\TrackingService;

class TrackingController extends Controller
{
    public function __construct(
        private TrackingService $trackingService,
        private DriverLocationService $driverLocationService,
    ) {
    }

    public function show(DispatchAssignment $assignment)
    {
        $perPage = max(1, min(500, (int) request()->query('per_page', 50)));
        $includeHistory = filter_var(request()->query('include_history', false), FILTER_VALIDATE_BOOL);

        $latest = $this->trackingService->latestForAssignment($assignment);

        return response()->json([
            'latest' => $this->trackingService->formatForFleet($latest),
            'history' => $includeHistory
                ? $this->driverLocationService->tripHistoryForAssignment($assignment, $perPage)
                : $assignment->trackingLogs()->latest('captured_at')->paginate($perPage),
        ]);
    }
}
