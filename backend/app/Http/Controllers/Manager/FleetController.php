<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Services\Gps\TrackingService;

class FleetController extends Controller
{
    public function __construct(private TrackingService $trackingService)
    {
    }

    public function index()
    {
        $assignments = DispatchAssignment::with('jobOrder', 'driver.user', 'vehicle')
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->latest('assigned_at')
            ->get();

        $data = $assignments->map(function (DispatchAssignment $a) {
            $latest = $this->trackingService->latestForAssignment($a);
            $history = $this->trackingService->historyForAssignment($a, 100);

            return [
                'id' => $a->id,
                'status' => $a->status,
                'driver' => $a->driver?->user?->name,
                'vehicle' => $a->vehicle?->plate_no,
                'job_order' => $a->jobOrder,
                'gps' => $this->trackingService->formatForFleet($latest),
                'route_history' => $history,
            ];
        });

        return response()->json(['data' => $data]);
    }
}
