<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;

class DashboardController extends Controller
{
    public function index()
    {
        return response()->json([
            'job_orders' => JobOrder::count(),
            'assignments_active' => DispatchAssignment::whereIn('status', ['assigned', 'in_progress'])->count(),
            'drivers_available' => Driver::where('availability', 'available')->count(),
            'vehicles_available' => Vehicle::where('status', 'available')->count(),
        ]);
    }
}
