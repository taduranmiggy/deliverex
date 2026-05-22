<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Support\DriverAccount;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function index(Request $request)
    {
        $driver = DriverAccount::require($request->user());

        return response()->json(
            DispatchAssignment::with('jobOrder', 'vehicle')
                ->where('driver_id', $driver->id)
                ->latest()
                ->paginate(20)
        );
    }

    public function show(DispatchAssignment $assignment)
    {
        $driver = DriverAccount::require(auth()->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json(
            $assignment->load('jobOrder', 'vehicle', 'deliveryStatusLogs', 'trackingLogs', 'deliveryDocuments.ocrResult')
        );
    }
}
