<?php

namespace App\Http\Controllers\Gps;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;

class TrackingController extends Controller
{
    public function show(DispatchAssignment $assignment)
    {
        return response()->json(
            $assignment->trackingLogs()->latest('captured_at')->paginate(50)
        );
    }
}
