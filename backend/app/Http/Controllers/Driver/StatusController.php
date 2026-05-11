<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\Vehicle;
use Illuminate\Http\Request;

class StatusController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'status' => 'required|string|max:80',
            'notes' => 'nullable|string',
        ]);

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driverId = $request->user()?->driver?->id;

        if ($assignment->driver_id !== $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status' => $data['status'],
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
        ]);

        $assignment->update(['status' => $data['status']]);

        if ($data['status'] === 'in_progress') {
            $assignment->update(['started_at' => now()]);
        }

        if ($data['status'] === 'completed') {
            $assignment->update(['completed_at' => now()]);
            $driver = Driver::find($assignment->driver_id);
            $vehicle = Vehicle::find($assignment->vehicle_id);
            $driver?->update(['availability' => 'available']);
            $vehicle?->update(['status' => 'available']);
            $assignment->jobOrder?->update(['status' => 'completed']);
        }

        return response()->json(['message' => 'Status updated']);
    }
}
