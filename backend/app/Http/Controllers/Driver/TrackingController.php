<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\TrackingLog;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    public function __construct(private NotificationDispatcher $notificationDispatcher)
    {
    }

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

        $lastLog = $assignment->trackingLogs()->latest('captured_at')->first();

        // Use firstOrCreate so replaying a queued offline batch (same point + timestamp)
        // does not create duplicate GPS logs on reconnect/auto-sync.
        $log = TrackingLog::firstOrCreate([
            'assignment_id' => $assignment->id,
            'captured_at'   => $data['captured_at'] ?? now(),
            'latitude'      => $data['latitude'],
            'longitude'     => $data['longitude'],
        ]);

        if ($lastLog && $lastLog->captured_at && $lastLog->captured_at->diffInMinutes(now()) >= 45) {
            $assignment->loadMissing('assignedBy', 'jobOrder');
            $code = $assignment->jobOrder?->tracking_code ?? (string) $assignment->job_order_id;
            $this->notificationDispatcher->notifyUser(
                $assignment->assignedBy,
                'Prolonged inactivity alert',
                'No GPS updates for job '.$code.' in the last 45 minutes.'
            );
            AuditLogger::record($request->user(), 'delivery.inactivity_alert', \App\Models\DispatchAssignment::class, $assignment->id, [
                'job_order_id' => $assignment->job_order_id,
                'last_ping_at' => $lastLog->captured_at?->toIso8601String(),
            ], $request);
        }

        return response()->json($log, 201);
    }
}
