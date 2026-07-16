<?php

namespace App\Services\Fleet;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Services\Driver\DriverAvailabilityService;
use App\Support\DeliveryStatus;
use Illuminate\Support\Facades\DB;

class AssignmentResourceSyncService
{
    public function __construct(
        private DriverAvailabilityService $driverAvailability,
        private VehicleAvailabilityService $vehicleAvailability,
    ) {
    }

    public function syncForAssignment(DispatchAssignment $assignment, string $reason, ?int $triggeredByUserId = null): void
    {
        $this->driverAvailability->syncForAssignment($assignment, $reason, $triggeredByUserId);
        $this->vehicleAvailability->syncForAssignment($assignment, $reason, $triggeredByUserId);
    }

    /**
     * Cancel active assignments on a job order and release driver/vehicle resources.
     *
     * @return list<int>
     */
    public function cancelActiveAssignmentsForJobOrder(int $jobOrderId, string $reason, ?int $triggeredByUserId = null): array
    {
        $cancelledIds = [];

        $assignments = DispatchAssignment::query()
            ->where('job_order_id', $jobOrderId)
            ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
            ->get();

        foreach ($assignments as $assignment) {
            $assignment->update(['status' => DeliveryStatus::CANCELLED]);
            $this->syncForAssignment($assignment, $reason, $triggeredByUserId);
            $cancelledIds[] = $assignment->id;
        }

        return $cancelledIds;
    }

    /**
     * Repair duplicate/orphan records and resync every driver and vehicle.
     *
     * @return array{driver_changes:int,vehicle_changes:int,duplicates_cancelled:int,pointers_cleared:int}
     */
    public function reconcileAll(string $reason = 'database_cleanup'): array
    {
        $duplicatesCancelled = 0;
        $pointersCleared = 0;

        DB::transaction(function () use (&$duplicatesCancelled, &$pointersCleared, $reason) {
            $this->repairStaleBlockingAssignments($reason);
            $duplicatesCancelled += $this->cancelDuplicateActiveAssignments('job_order_id');
            $duplicatesCancelled += $this->cancelDuplicateActiveAssignments('driver_id');
            $duplicatesCancelled += $this->cancelDuplicateActiveAssignments('vehicle_id');
            $pointersCleared += $this->clearStaleDriverPointers();
        });

        return [
            'driver_changes'        => $this->driverAvailability->reconcileAll($reason),
            'vehicle_changes'       => $this->vehicleAvailability->reconcileAll($reason),
            'duplicates_cancelled'  => $duplicatesCancelled,
            'pointers_cleared'      => $pointersCleared,
        ];
    }

    private function cancelDuplicateActiveAssignments(string $groupColumn): int
    {
        $cancelled = 0;

        $duplicateGroups = DispatchAssignment::query()
            ->select($groupColumn)
            ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
            ->groupBy($groupColumn)
            ->havingRaw('COUNT(*) > 1')
            ->pluck($groupColumn);

        foreach ($duplicateGroups as $groupId) {
            $activeAssignments = DispatchAssignment::query()
                ->where($groupColumn, $groupId)
                ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
                ->orderByDesc('id')
                ->get();

            foreach ($activeAssignments->slice(1) as $duplicate) {
                $duplicate->update(['status' => DeliveryStatus::CANCELLED]);
                $this->syncForAssignment($duplicate, 'duplicate_assignment_cleanup');
                $cancelled++;
            }
        }

        return $cancelled;
    }

    private function clearStaleDriverPointers(): int
    {
        $cleared = 0;

        Driver::query()
            ->whereNotNull('current_assignment_id')
            ->each(function (Driver $driver) use (&$cleared) {
                $assignment = DispatchAssignment::query()->find($driver->current_assignment_id);

                if (! $assignment
                    || $assignment->driver_id !== $driver->id
                    || DeliveryStatus::isTerminal($assignment->status)) {
                    $driver->update(['current_assignment_id' => null]);
                    $cleared++;
                }
            });

        return $cleared;
    }

    /**
     * Close assignments that still block availability after their job order finished
     * or after completed_at was recorded without a terminal status.
     */
    public function repairStaleBlockingAssignments(string $reason = 'stale_assignment_cleanup'): int
    {
        $repaired = 0;

        DispatchAssignment::query()
            ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
            ->whereHas('jobOrder', fn ($q) => $q->whereIn('status', ['completed', 'cancelled']))
            ->each(function (DispatchAssignment $assignment) use (&$repaired, $reason) {
                $assignment->update([
                    'status'       => DeliveryStatus::COMPLETED,
                    'completed_at' => $assignment->completed_at ?? now(),
                ]);
                $this->syncForAssignment($assignment, $reason);
                $repaired++;
            });

        DispatchAssignment::query()
            ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
            ->whereNotNull('completed_at')
            ->each(function (DispatchAssignment $assignment) use (&$repaired, $reason) {
                $assignment->update(['status' => DeliveryStatus::COMPLETED]);
                $this->syncForAssignment($assignment, $reason);
                $repaired++;
            });

        return $repaired;
    }
}
