<?php

namespace App\Http\Controllers;

use App\Services\Performance\DriverPerformanceScoringService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DriverPerformanceController extends Controller
{
    public function __construct(private DriverPerformanceScoringService $scoringService)
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

        return response()->json($this->scoringService->scoreAll($from, $to, $limit));
    }
}
