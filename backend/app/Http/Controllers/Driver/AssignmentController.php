<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function index(Request $request)
    {
        $driverId = $request->user()?->driver?->id;

        return response()->json(
            DispatchAssignment::with('jobOrder', 'vehicle')
                ->where('driver_id', $driverId)
                ->latest()
                ->paginate(20)
        );
    }

    public function show(DispatchAssignment $assignment)
    {
        $driverId = auth()->user()?->driver?->id;

        if ($assignment->driver_id !== $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json(
            $assignment->load('jobOrder', 'vehicle', 'deliveryStatusLogs', 'trackingLogs', 'deliveryDocuments.ocrResult')
        );
    }
}
