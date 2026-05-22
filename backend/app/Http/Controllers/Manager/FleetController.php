<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Models\TrackingLog;

class FleetController extends Controller
{
    public function index()
    {
        $assignments = DispatchAssignment::with('jobOrder', 'driver.user', 'vehicle')
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->latest('assigned_at')
            ->get();

        $data = $assignments->map(function (DispatchAssignment $a) {
            $latest = TrackingLog::where('assignment_id', $a->id)
                ->orderByDesc('captured_at')
                ->first();

            return [
                'id'         => $a->id,
                'status'     => $a->status,
                'driver'     => $a->driver?->user?->name,
                'vehicle'    => $a->vehicle?->plate_no,
                'job_order'  => $a->jobOrder,
                'gps'        => $latest ? [
                    'lat' => (float) $latest->latitude,
                    'lng' => (float) $latest->longitude,
                    'at'  => $latest->captured_at?->toIso8601String(),
                ] : null,
            ];
        });

        return response()->json(['data' => $data]);
    }
}
