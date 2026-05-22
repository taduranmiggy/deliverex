<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\TrackingLog;
use App\Models\Vehicle;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AuditLogger;
use App\Support\DriverAccount;
use Illuminate\Http\Request;

class StatusController extends Controller
{
    public function __construct(private NotificationDispatcher $notificationDispatcher)
    {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'status'        => 'required|string|max:80',
            'notes'         => 'nullable|string',
            'latitude'      => 'nullable|numeric',
            'longitude'     => 'nullable|numeric',
        ]);

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $status = $this->normalizeStatus($data['status']);
        if (! $status) {
            return response()->json(['message' => 'Invalid status stage'], 422);
        }

        // Prevent backwards transitions
        if (! $this->isValidTransition($assignment->status, $status)) {
            return response()->json([
                'message' => "Cannot transition from '{$assignment->status}' to '{$status}'.",
            ], 422);
        }

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status'        => $status,
            'notes'         => $data['notes'] ?? null,
            'created_at'    => now(),
        ]);

        $assignment->update(['status' => $status]);
        $this->notificationDispatcher->statusUpdated($assignment, $status);

        if ($data['latitude'] !== null && $data['longitude'] !== null) {
            TrackingLog::create([
                'assignment_id' => $assignment->id,
                'latitude'      => $data['latitude'],
                'longitude'     => $data['longitude'],
                'captured_at'   => now(),
            ]);
        }

        if ($status === 'in_progress') {
            $assignment->update(['started_at' => now()]);
            $assignment->jobOrder?->update(['status' => 'in_progress']);
            $driver = Driver::find($assignment->driver_id);
            $vehicle = Vehicle::find($assignment->vehicle_id);
            $driver?->update([
                'availability'          => 'busy',
                'current_assignment_id' => $assignment->id,
            ]);
            $vehicle?->update(['status' => 'assigned']);
        }

        // Propagate arrived to job order
        if ($status === 'arrived') {
            $assignment->jobOrder?->update(['status' => 'arrived']);
        }

        if (in_array($status, ['completed', 'cancelled'], true)) {
            if ($status === 'completed') {
                $assignment->update(['completed_at' => now()]);
            }
            $driver  = Driver::find($assignment->driver_id);
            $vehicle = Vehicle::find($assignment->vehicle_id);
            $driver?->update([
                'availability'          => 'available',
                'current_assignment_id' => null,
            ]);
            $vehicle?->update(['status' => 'available']);
            $assignment->jobOrder?->update(['status' => $status]);

            if ($status === 'completed') {
                $this->notificationDispatcher->deliveryCompleted($assignment);
            }
        }

        if ($this->isDelay($assignment) && ! in_array($status, ['completed', 'cancelled'], true)) {
            $assignment->loadMissing('assignedBy', 'jobOrder');
            $code = $assignment->jobOrder?->tracking_code ?? (string) $assignment->job_order_id;
            $this->notificationDispatcher->notifyUser(
                $assignment->assignedBy,
                'Delivery delay alert',
                'Job ' . $code . ' is past its scheduled window. Please review.'
            );
            AuditLogger::record($request->user(), 'delivery.delay_alert', DispatchAssignment::class, $assignment->id, [
                'job_order_id' => $assignment->job_order_id,
                'status'       => $status,
            ], $request);
        }

        return response()->json(['message' => 'Status updated', 'status' => $status]);
    }

    private function normalizeStatus(string $status): ?string
    {
        $value = strtolower(trim($status));
        $map   = [
            'assigned'    => 'assigned',
            'dispatched'  => 'assigned',
            'en_route'    => 'in_progress',
            'en route'    => 'in_progress',
            'in_progress' => 'in_progress',
            'arrived'     => 'arrived',
            'delivered'   => 'completed',
            'completed'   => 'completed',
            'cancelled'   => 'cancelled',
        ];

        return $map[$value] ?? null;
    }

    /** Prevent nonsensical backward transitions. */
    private function isValidTransition(string $current, string $next): bool
    {
        $order = [
            'assigned'   => 1,
            'in_progress'=> 2,
            'arrived'    => 3,
            'completed'  => 4,
            'cancelled'  => 4,
        ];

        $currentRank = $order[$current] ?? 0;
        $nextRank    = $order[$next]    ?? 0;

        // Allow re-sending the same status (idempotent), or advancing forward, or cancelling at any stage.
        return $next === 'cancelled' || $nextRank >= $currentRank;
    }

    private function isDelay(DispatchAssignment $assignment): bool
    {
        $assignment->loadMissing('jobOrder');
        $job = $assignment->jobOrder;
        if (! $job || ! $job->scheduled_end) {
            return false;
        }

        return now()->isAfter($job->scheduled_end);
    }
}
