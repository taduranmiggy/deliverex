<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\TrackingLog;
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'captured_at' => 'nullable|date',
        ]);

        $assignment = \App\Models\DispatchAssignment::findOrFail($data['assignment_id']);
        $driverId = $request->user()?->driver?->id;

        if ($assignment->driver_id !== $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $log = TrackingLog::create([
            'assignment_id' => $assignment->id,
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'captured_at' => $data['captured_at'] ?? now(),
        ]);

        return response()->json($log, 201);
    }
}
