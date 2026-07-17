<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Services\Gps\FleetLiveTrackingService;

class FleetLiveTrackingController extends Controller
{
    public function __construct(private FleetLiveTrackingService $fleetLiveTracking)
    {
    }

    public function index()
    {
        return response()->json([
            'synced_at' => now()->toIso8601String(),
            'data' => $this->fleetLiveTracking->activeDeliveries(),
        ]);
    }
}
