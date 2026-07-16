<?php

namespace App\Services\Driver;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\DriverAvailabilityLog;
use App\Support\DeliveryStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;

class DriverAvailabilityService
{
    /**
     * A driver can receive new assignments when they are not admin-offline/inactive
     * and have no assignments in availability-blocking statuses.
     */
    public function isAssignable(Driver $driver): bool
    {
        if ($this->isAdminUnavailable($driver)) {
            return false;
        }

        return ! $this->hasActiveAssignments($driver);
    }

    public function isAdminUnavailable(Driver $driver): bool
    {
        return $driver->status === 'inactive' || $driver->availability === 'offline';
    }

    public function hasActiveAssignments(Driver|int $driver): bool
    {
        $driverId = $driver instanceof Driver ? $driver->id : $driver;

        return $this->activeAssignmentsQuery($driverId)->exists();
    }

    public function activeAssignmentsQuery(int $driverId): Builder
    {
        return DispatchAssignment::query()
            ->where('driver_id', $driverId)
            ->whereIn('status', DeliveryStatus::availabilityBlocking());
    }

    public function activeAssignmentCount(Driver|int $driver): int
    {
        $driverId = $driver instanceof Driver ? $driver->id : $driver;

        return $this->activeAssignmentsQuery($driverId)->count();
    }

    /**
     * Derive operational availability from active assignments.
     * Admin-offline/inactive is preserved only when there are no active assignments.
     */
    public function deriveAvailability(Driver $driver): string
    {
        if ($this->hasActiveAssignments($driver)) {
            return 'busy';
        }

        if ($driver->status === 'inactive' || $driver->availability === 'offline') {
            return 'offline';
        }

        return 'available';
    }

    /**
     * Derive the driver.status field shown in fleet/admin UIs.
     */
    public function deriveOperationalStatus(Driver $driver): string
    {
        if ($driver->status === 'inactive') {
            return 'inactive';
        }

        if ($driver->availability === 'offline' && ! $this->hasActiveAssignments($driver)) {
            return 'offline';
        }

        $primary = $this->primaryActiveAssignment($driver);
        if (! $primary) {
            return 'available';
        }

        $canonical = DeliveryStatus::canonicalize($primary->status) ?? $primary->status;

        return $canonical === DeliveryStatus::ASSIGNED ? 'assigned' : 'on_delivery';
    }

    public function primaryActiveAssignment(Driver|int $driver): ?DispatchAssignment
    {
        $driverId = $driver instanceof Driver ? $driver->id : $driver;

        $inProgressStatuses = [
            DeliveryStatus::EN_ROUTE_TO_PICKUP,
            DeliveryStatus::ARRIVED_AT_PICKUP,
            DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            DeliveryStatus::ARRIVED_AT_DESTINATION,
            DeliveryStatus::ARRIVED,
        ];

        $inProgress = DispatchAssignment::query()
            ->where('driver_id', $driverId)
            ->whereIn('status', $inProgressStatuses)
            ->orderByDesc('started_at')
            ->orderByDesc('assigned_at')
            ->orderByDesc('id')
            ->first();

        if ($inProgress) {
            return $inProgress;
        }

        return DispatchAssignment::query()
            ->where('driver_id', $driverId)
            ->where('status', DeliveryStatus::ASSIGNED)
            ->orderByDesc('assigned_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Synchronize stored availability/current_assignment_id with active assignments.
     *
     * @return array{previous:string,new:string,reason:string,driver_id:int}|null
     */
    public function sync(Driver|int $driver, string $reason, ?int $triggeredByUserId = null): ?array
    {
        $model = $driver instanceof Driver
            ? $driver
            : Driver::query()->findOrFail($driver);

        $previous = $model->availability ?? 'available';
        $previousStatus = $model->status ?? 'available';
        $previousAssignmentId = $model->current_assignment_id;
        $derived = $this->deriveAvailability($model);
        $derivedStatus = $this->deriveOperationalStatus($model);
        $primaryAssignment = $this->primaryActiveAssignment($model);
        $nextAssignmentId = $primaryAssignment?->id;

        if ($previous === $derived
            && $previousStatus === $derivedStatus
            && $previousAssignmentId === $nextAssignmentId) {
            return null;
        }

        $model->update([
            'availability'          => $derived,
            'status'                => $derivedStatus,
            'current_assignment_id' => $nextAssignmentId,
        ]);

        $change = [
            'driver_id'                  => $model->id,
            'previous'                   => $previous,
            'new'                      => $derived,
            'previous_status'            => $previousStatus,
            'new_status'                 => $derivedStatus,
            'reason'                     => $reason,
            'previous_assignment_id'     => $previousAssignmentId,
            'current_assignment_id'      => $nextAssignmentId,
            'active_assignment_count'    => $this->activeAssignmentCount($model),
        ];

        $this->logChange($model, $change, $triggeredByUserId);

        Log::info('Driver availability synchronized', $change);

        return $change;
    }

    public function syncForAssignment(DispatchAssignment $assignment, string $reason, ?int $triggeredByUserId = null): void
    {
        if ($assignment->driver_id) {
            $this->sync($assignment->driver_id, $reason, $triggeredByUserId);
        }
    }

    /**
     * Cancel all availability-blocking assignments for a job order and sync affected drivers.
     * Prefer AssignmentResourceSyncService for full driver + vehicle sync.
     *
     * @return list<int> Cancelled assignment IDs
     */
    public function cancelActiveAssignmentsForJobOrder(int $jobOrderId, string $reason, ?int $triggeredByUserId = null): array
    {
        return app(\App\Services\Fleet\AssignmentResourceSyncService::class)
            ->cancelActiveAssignmentsForJobOrder($jobOrderId, $reason, $triggeredByUserId);
    }

    /**
     * Repair stale flags and resync all drivers from active assignments.
     */
    public function reconcileAll(string $reason = 'database_cleanup'): int
    {
        $changes = 0;

        Driver::query()->each(function (Driver $driver) use (&$changes, $reason) {
            if ($this->sync($driver, $reason) !== null) {
                $changes++;
            }
        });

        return $changes;
    }

    private function logChange(Driver $driver, array $change, ?int $triggeredByUserId): void
    {
        try {
            DriverAvailabilityLog::create([
                'driver_id'              => $driver->id,
                'previous_availability'  => $change['previous'],
                'new_availability'       => $change['new'],
                'reason'                 => $change['reason'],
                'previous_assignment_id' => $change['previous_assignment_id'],
                'current_assignment_id'  => $change['current_assignment_id'],
                'active_assignment_count'=> $change['active_assignment_count'],
                'triggered_by_user_id'   => $triggeredByUserId,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to write driver availability log', [
                'driver_id' => $driver->id,
                'error'     => $e->getMessage(),
            ]);
        }
    }
}
