<?php

namespace App\Http\Controllers;

use App\Services\Performance\VehicleUtilizationAnalyticsService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class VehicleUtilizationController extends Controller
{
    public function __construct(private VehicleUtilizationAnalyticsService $analyticsService)
    {
    }

    public function index(Request $request)
    {
        $from = $request->query('from')
            ? Carbon::parse($request->query('from'))->startOfDay()
            : null;
        $to = $request->query('to')
            ? Carbon::parse($request->query('to'))->endOfDay()
            : null;

        $limit = min(20, max(1, (int) $request->query('limit', 5)));

        return response()->json($this->analyticsService->analyzeAll($from, $to, $limit));
    }
}
