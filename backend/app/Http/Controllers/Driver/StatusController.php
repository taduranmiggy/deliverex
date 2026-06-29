<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryStatusHistory;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\TrackingLog;
use App\Models\Vehicle;
use App\Services\Delivery\ArrivalVerificationService;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\ActionTimestamp;
use App\Support\AuditLogger;
use App\Support\DeliveryStatus;
use App\Support\DriverAccount;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StatusController extends Controller
{
    public function __construct(
        private NotificationDispatcher $notificationDispatcher,
        private ArrivalVerificationService $arrivalVerification,
    ) {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id'     => 'required|exists:dispatch_assignments,id',
            'status'            => 'required|string|max:80',
            'notes'             => 'nullable|string',
            'latitude'          => 'nullable|numeric',
            'longitude'         => 'nullable|numeric',
            'action_timestamp'  => 'nullable|date',
            'action_taken_at'   => 'nullable|date',
        ]);

        $actionAt = ActionTimestamp::resolveFromRequest($request);

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $currentStatus = DeliveryStatus::canonicalize($assignment->status) ?? $assignment->status;
        $status = $this->normalizeStatus($data['status'], $currentStatus);
        if (! $status) {
            return response()->json(['message' => 'Invalid status stage'], 422);
        }

        // Prevent backwards transitions
        if (! $this->isValidTransition($currentStatus, $status)) {
            return response()->json([
                'message' => "Cannot transition from '{$currentStatus}' to '{$status}'.",
            ], 422);
        }

        $latitude  = $data['latitude'] ?? null;
        $longitude = $data['longitude'] ?? null;

        // Start Trip Verification: require GPS proof when leaving "assigned" for "en route".
        // Accept a prior tracking log (e.g. dashboard GPS ping) as already-captured proof.
        $isStartTrip = $status === DeliveryStatus::EN_ROUTE_TO_PICKUP && $currentStatus === DeliveryStatus::ASSIGNED;
        if ($isStartTrip && ($latitude === null || $longitude === null)
            && ! $assignment->trackingLogs()->exists()) {
            return response()->json([
                'message' => 'GPS location is required to start the trip. Enable location and try again.',
            ], 422);
        }

        // Arrival Verification: require GPS within radius of drop-off destination.
        $isArrivalVerify = $status === DeliveryStatus::ARRIVED && $currentStatus === DeliveryStatus::EN_ROUTE_TO_DESTINATION;
        $arrivalVerified = null;

        if ($isArrivalVerify) {
            if ($latitude === null || $longitude === null) {
                return response()->json([
                    'message' => 'GPS location is required to confirm arrival. Enable location and try again.',
                ], 422);
            }

            $assignment->loadMissing('jobOrder');
            $verification = $this->arrivalVerification->verify(
                (float) $latitude,
                (float) $longitude,
                $assignment->jobOrder,
            );

            if (! $verification['verified']) {
                return response()->json([
                    'message'          => $verification['error'] ?? 'You are too far from the delivery destination.',
                    'distance_meters'  => $verification['distance_meters'] ?? null,
                    'allowed_meters'   => $verification['allowed_meters'] ?? config('delivery.arrival_radius_meters', 300),
                ], 422);
            }

            $arrivalVerified = true;
        }

        // Completion proof required before marking delivery as completed.
        $isComplete = $status === DeliveryStatus::COMPLETED && $currentStatus === DeliveryStatus::ARRIVED;
        if ($isComplete && ! DeliveryCompletionProof::where('assignment_id', $assignment->id)->exists()) {
            return response()->json([
                'message' => 'Delivery completion proof is required. Upload a receipt photo or OCR document before completing.',
            ], 422);
        }

        DB::transaction(function () use ($assignment, $status, $data, $latitude, $longitude, $arrivalVerified, $request, $actionAt) {
            DeliveryStatusLog::create([
                'assignment_id'    => $assignment->id,
                'status'           => $status,
                'notes'            => $data['notes'] ?? null,
                'latitude'         => $latitude,
                'longitude'        => $longitude,
                'arrival_verified' => $arrivalVerified,
                'created_at'       => $actionAt,
            ]);

            $this->logStatusHistory(
                assignment: $assignment,
                status: $status,
                updatedBy: $request->user()?->id,
                latitude: $latitude,
                longitude: $longitude,
                remarks: $data['notes'] ?? null,
                actionAt: $actionAt,
            );

            $assignment->update(['status' => $status]);
        });

        $assignment->refresh();
        $this->notificationDispatcher->statusUpdated($assignment, $status);

        if ($latitude !== null && $longitude !== null) {
            TrackingLog::create([
                'assignment_id' => $assignment->id,
                'latitude'      => $latitude,
                'longitude'     => $longitude,
                'captured_at'   => $actionAt,
            ]);
        }

        if ($status === DeliveryStatus::EN_ROUTE_TO_PICKUP) {
            $assignment->update(['started_at' => $actionAt]);
            $assignment->jobOrder?->update(['status' => DeliveryStatus::toJobOrderStatus($status)]);
            $driver = Driver::find($assignment->driver_id);
            $vehicle = Vehicle::find($assignment->vehicle_id);
            $driver?->update([
                'availability'          => 'busy',
                'current_assignment_id' => $assignment->id,
            ]);
            $vehicle?->update(['status' => 'assigned']);
        }

        // Propagate arrived to job order
        if ($status === DeliveryStatus::ARRIVED) {
            $assignment->jobOrder?->update(['status' => DeliveryStatus::toJobOrderStatus($status)]);
        }

        if (in_array($status, [DeliveryStatus::ARRIVED_AT_PICKUP, DeliveryStatus::EN_ROUTE_TO_DESTINATION], true)) {
            $assignment->jobOrder?->update(['status' => DeliveryStatus::toJobOrderStatus($status)]);
        }

        if (in_array($status, [DeliveryStatus::COMPLETED, DeliveryStatus::CANCELLED], true)) {
            if ($status === DeliveryStatus::COMPLETED) {
                $assignment->update(['completed_at' => $actionAt]);
            }
            $driver  = Driver::find($assignment->driver_id);
            $vehicle = Vehicle::find($assignment->vehicle_id);
            $driver?->update([
                'availability'          => 'available',
                'current_assignment_id' => null,
            ]);
            $vehicle?->update(['status' => 'available']);
            $assignment->jobOrder?->update(['status' => $status]);

            if ($status === DeliveryStatus::COMPLETED) {
                $this->notificationDispatcher->deliveryCompleted($assignment);
            }
        }

        if ($this->isDelay($assignment) && ! in_array($status, [DeliveryStatus::COMPLETED, DeliveryStatus::CANCELLED], true)) {
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

        $nextAction = DeliveryStatus::nextAction($status);

        return response()->json([
            'message'          => 'Status updated',
            'status'           => $status,
            'event_at'         => $actionAt->toIso8601String(),
            'arrival_verified' => $arrivalVerified,
            'next_status'      => $nextAction['next_status'],
            'allowed_action'   => $nextAction['label'],
        ]);
    }

    private function normalizeStatus(string $status, string $currentStatus): ?string
    {
        $normalized = DeliveryStatus::canonicalize($status);
        if (! $normalized) {
            return null;
        }

        // Backward compatibility for legacy frontend actions.
        $value = strtolower(trim($status));
        if (in_array($value, ['in_progress', 'en_route', 'en route'], true)) {
            if ($currentStatus === DeliveryStatus::ASSIGNED) {
                return DeliveryStatus::EN_ROUTE_TO_PICKUP;
            }

            if (in_array($currentStatus, [DeliveryStatus::EN_ROUTE_TO_PICKUP, DeliveryStatus::ARRIVED_AT_PICKUP], true)) {
                return DeliveryStatus::EN_ROUTE_TO_DESTINATION;
            }
        }

        if ($value === 'arrived' && $currentStatus === DeliveryStatus::EN_ROUTE_TO_PICKUP) {
            return DeliveryStatus::ARRIVED_AT_PICKUP;
        }

        return $normalized;
    }

    /** Prevent nonsensical backward transitions. */
    private function isValidTransition(string $current, string $next): bool
    {
        return DeliveryStatus::canTransition($current, $next);
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

    private function logStatusHistory(
        DispatchAssignment $assignment,
        string $status,
        ?int $updatedBy = null,
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $remarks = null,
        ?Carbon $actionAt = null,
    ): void {
        $actionAt ??= now();

        try {
            DeliveryStatusHistory::create([
                'job_order_id' => $assignment->job_order_id,
                'assignment_id' => $assignment->id,
                'status' => $status,
                'updated_by' => $updatedBy,
                'updated_at' => $actionAt,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'remarks' => $remarks,
                'created_at' => $actionAt,
            ]);
        } catch (\Throwable $e) {
            // Status history is supplementary; never block a driver's status update.
            Log::warning('Failed to write delivery status history', [
                'assignment_id' => $assignment->id,
                'status' => $status,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
