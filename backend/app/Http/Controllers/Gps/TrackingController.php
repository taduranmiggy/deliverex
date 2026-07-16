<?php

namespace App\Http\Controllers\Gps;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Services\Gps\TrackingService;

class TrackingController extends Controller
{
    public function __construct(private TrackingService $trackingService)
    {
    }

    public function show(DispatchAssignment $assignment)
    {
        $perPage = max(1, min(500, (int) request()->query('per_page', 50)));
        $includeHistory = filter_var(request()->query('include_history', false), FILTER_VALIDATE_BOOL);

        $latest = $this->trackingService->latestForAssignment($assignment);

        return response()->json([
            'latest' => $this->trackingService->formatForFleet($latest),
            'history' => $includeHistory
                ? $this->trackingService->historyForAssignment($assignment, $perPage)
                : $assignment->trackingLogs()->latest('captured_at')->paginate($perPage),
        ]);
    }
}
