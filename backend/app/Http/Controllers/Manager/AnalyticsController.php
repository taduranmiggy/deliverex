<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Models\JobOrder;

class AnalyticsController extends Controller
{
    public function index()
    {
        return response()->json([
            'jobs_completed' => JobOrder::where('status', 'completed')->count(),
            'jobs_pending' => JobOrder::where('status', 'pending')->count(),
            'assignments_completed' => DispatchAssignment::where('status', 'completed')->count(),
        ]);
    }
}
