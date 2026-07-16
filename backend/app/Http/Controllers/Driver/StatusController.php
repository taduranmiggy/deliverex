<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryStatusHistory;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\SyncConflict;
use App\Services\Delivery\ArrivalVerificationService;
use App\Services\Driver\DriverAvailabilityService;
use App\Services\Fleet\AssignmentResourceSyncService;
use App\Services\Gps\TrackingService;
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
        private AssignmentResourceSyncService $resourceSync,
        private TrackingService $trackingService,
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
            'action_timestamp'  => 'nullable|string',
            'action_taken_at'   => 'nullable|string',
            'expected_current_status' => 'nullable|string|max:80',
        ]);

        $timestampMeta = ActionTimestamp::resolveFromRequestWithMeta($request);
        $actionAt = $timestampMeta['actionAt'];
        $fromClient = $timestampMeta['fromClient'];
        $syncedAt = $fromClient ? now() : null;

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $currentStatus = DeliveryStatus::canonicalize($assignment->status) ?? $assignment->status;
        $expectedCurrent = isset($data['expected_current_status'])
            ? DeliveryStatus::canonicalize($data['expected_current_status'])
            : null;

        if ($expectedCurrent && $expectedCurrent !== $currentStatus) {
            return $this->conflictResponse($assignment, $currentStatus, $data, $request);
        }

        $status = $this->normalizeStatus($data['status'], $currentStatus);
        if (! $status) {
            return response()->json(['message' => 'Invalid status stage'], 422);
        }

        // Prevent backwards transitions
        if (! $this->isValidTransition($currentStatus, $status)) {
            if ($syncedAt !== null || $expectedCurrent) {
                return $this->conflictResponse($assignment, $currentStatus, $data, $request, $status);
            }

            return response()->json([
                'message' => "Cannot transition from '{$currentStatus}' to '{$status}'.",
            ], 422);
        }

        $previousStatus = $currentStatus;

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
        $isArrivalVerify = $status === DeliveryStatus::ARRIVED_AT_DESTINATION
            && $currentStatus === DeliveryStatus::EN_ROUTE_TO_DESTINATION;
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
        $isComplete = $status === DeliveryStatus::COMPLETED
            && $currentStatus === DeliveryStatus::ARRIVED_AT_DESTINATION;
        if ($isComplete && ! DeliveryCompletionProof::where('assignment_id', $assignment->id)->exists()) {
            return response()->json([
                'message' => 'Delivery completion proof is required. Upload a receipt photo or OCR document before completing.',
            ], 422);
        }

        DB::transaction(function () use ($assignment, $status, $data, $latitude, $longitude, $arrivalVerified, $request, $actionAt, $syncedAt, $previousStatus) {
            DeliveryStatusLog::create([
                'assignment_id'    => $assignment->id,
                'status'           => $status,
                'notes'            => $data['notes'] ?? null,
                'latitude'         => $latitude,
                'longitude'        => $longitude,
                'arrival_verified' => $arrivalVerified,
                'created_at'       => $actionAt,
                'synced_at'        => $syncedAt,
            ]);

            $this->logStatusHistory(
                assignment: $assignment,
                status: $status,
                previousStatus: $previousStatus,
                updatedBy: $request->user()?->id,
                latitude: $latitude,
                longitude: $longitude,
                remarks: $data['notes'] ?? null,
                actionAt: $actionAt,
            );

            $assignmentUpdates = ['status' => $status];

            if ($status === DeliveryStatus::EN_ROUTE_TO_PICKUP) {
                $assignmentUpdates['started_at'] = $actionAt;
            }

            if ($status === DeliveryStatus::COMPLETED) {
                $assignmentUpdates['completed_at'] = $actionAt;
            }

            $assignment->update($assignmentUpdates);

            $this->resourceSync->syncForAssignment(
                $assignment,
                'driver_status_update:'.$status,
                $request->user()?->id,
            );
        });

        $assignment->refresh();
        $this->notificationDispatcher->statusUpdated($assignment, $status);

        AuditLogger::recordChanges(
            $request->user(),
            'delivery.status_changed',
            DispatchAssignment::class,
            $assignment->id,
            ['status' => ['old' => $previousStatus, 'new' => $status]],
            [
                'job_order_id' => $assignment->job_order_id,
                'performed_offline' => $syncedAt !== null,
            ],
            $request,
        );

        if ($status === DeliveryStatus::EN_ROUTE_TO_PICKUP && $previousStatus === DeliveryStatus::ASSIGNED) {
            AuditLogger::record($request->user(), 'gps.started', DispatchAssignment::class, $assignment->id, [
                'job_order_id' => $assignment->job_order_id,
            ], $request);
        }

        if (in_array($status, [DeliveryStatus::COMPLETED, DeliveryStatus::CANCELLED], true)) {
            AuditLogger::record($request->user(), 'gps.stopped', DispatchAssignment::class, $assignment->id, [
                'job_order_id' => $assignment->job_order_id,
                'reason' => $status,
            ], $request);
        }

        if ($latitude !== null && $longitude !== null) {
            $this->trackingService->record($assignment, [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'captured_at' => $actionAt,
                'synced_at' => $syncedAt,
                'source' => 'status_update:'.$status,
                'force' => true,
            ], $assignment->driver_id);
        }

        if ($status === DeliveryStatus::EN_ROUTE_TO_PICKUP) {
            $assignment->jobOrder?->update(['status' => DeliveryStatus::toJobOrderStatus($status)]);
        }

        // Propagate arrived to job order
        if ($status === DeliveryStatus::ARRIVED_AT_DESTINATION) {
            $assignment->jobOrder?->update(['status' => DeliveryStatus::toJobOrderStatus($status)]);
        }

        if (in_array($status, [DeliveryStatus::ARRIVED_AT_PICKUP, DeliveryStatus::EN_ROUTE_TO_DESTINATION], true)) {
            $assignment->jobOrder?->update(['status' => DeliveryStatus::toJobOrderStatus($status)]);
        }

        if (in_array($status, [DeliveryStatus::COMPLETED, DeliveryStatus::CANCELLED], true)) {
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
        $lifecycleIndex = array_search($status, DeliveryStatus::lifecycle(), true);

        return response()->json([
            'message'           => 'Status updated',
            'status'            => $status,
            'current_status'    => $status,
            'previous_status'   => $previousStatus,
            'current_step'      => $lifecycleIndex !== false ? $lifecycleIndex + 1 : null,
            'dispatcher_phase'  => DeliveryStatus::dispatcherPhase($status),
            'event_at'          => $actionAt->toIso8601String(),
            'synced_at'         => $syncedAt?->toIso8601String(),
            'performed_offline' => $syncedAt !== null,
            'arrival_verified'  => $arrivalVerified,
            'next_status'       => $nextAction['next_status'],
            'allowed_action'    => $nextAction['label'],
            'timeline'          => $this->formatTimeline($assignment),
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
        ?string $previousStatus = null,
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
                'driver_id' => $assignment->driver_id,
                'status' => $status,
                'previous_status' => $previousStatus,
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

    private function conflictResponse(
        DispatchAssignment $assignment,
        string $serverStatus,
        array $data,
        Request $request,
        ?string $requestedStatus = null,
    ) {
        $clientStatus = DeliveryStatus::canonicalize($data['expected_current_status'] ?? $serverStatus) ?? $serverStatus;
        $requested = $requestedStatus
            ? DeliveryStatus::canonicalize($requestedStatus)
            : DeliveryStatus::canonicalize($data['status']);

        $serverVersion = [
            'status' => $serverStatus,
            'label' => DeliveryStatus::label($serverStatus),
            'updated_at' => $assignment->updated_at?->toIso8601String(),
        ];

        $clientVersion = [
            'status' => $requested ?? $data['status'],
            'label' => DeliveryStatus::label($requested ?? $data['status']),
            'expected_current_status' => $clientStatus,
            'action_timestamp' => $data['action_timestamp'] ?? $data['action_taken_at'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];

        $changedFields = ['status'];
        if (($data['notes'] ?? null) !== null) {
            $changedFields[] = 'notes';
        }

        SyncConflict::create([
            'user_id' => $request->user()->id,
            'action_type' => 'status',
            'entity_type' => DispatchAssignment::class,
            'entity_id' => $assignment->id,
            'server_version' => $serverVersion,
            'client_version' => $clientVersion,
            'changed_fields' => $changedFields,
            'client_action_at' => ActionTimestamp::resolve($data['action_timestamp'] ?? $data['action_taken_at'] ?? null),
        ]);

        AuditLogger::record($request->user(), 'offline.conflict_detected', DispatchAssignment::class, $assignment->id, [
            'server_status' => $serverStatus,
            'client_status' => $clientVersion['status'],
        ], $request);

        return response()->json([
            'message' => 'Sync conflict detected. The server record changed while you were offline.',
            'conflict' => [
                'server_version' => $serverVersion,
                'client_version' => $clientVersion,
                'changed_fields' => $changedFields,
                'assignment_id' => $assignment->id,
            ],
        ], 409);
    }

    /** @return list<array<string, mixed>> */
    private function formatTimeline(DispatchAssignment $assignment): array
    {
        return DeliveryStatusHistory::query()
            ->where('assignment_id', $assignment->id)
            ->orderBy('updated_at')
            ->get()
            ->map(fn (DeliveryStatusHistory $row) => [
                'status' => DeliveryStatus::canonicalize($row->status) ?? $row->status,
                'label' => DeliveryStatus::label(DeliveryStatus::canonicalize($row->status) ?? $row->status),
                'previous_status' => $row->previous_status
                    ? (DeliveryStatus::canonicalize($row->previous_status) ?? $row->previous_status)
                    : null,
                'event_at' => $row->updated_at?->toIso8601String(),
                'latitude' => $row->latitude,
                'longitude' => $row->longitude,
            ])
            ->values()
            ->all();
    }
}
