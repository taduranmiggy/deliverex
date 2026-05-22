<?php

namespace App\Support;

use App\Models\DispatchAssignment;
use App\Models\JobOrder;
use Illuminate\Support\Carbon;

class AssignmentScheduleConflict
{
    /**
     * Active assignments that block reuse unless schedules do not overlap.
     */
    public static function activeAssignmentQuery()
    {
        return DispatchAssignment::query()
            ->whereNotIn('status', ['completed', 'cancelled']);
    }

    public static function hasDriverConflict(int $driverId, JobOrder $job, ?int $excludeAssignmentId = null): bool
    {
        return self::conflictingAssignments('driver_id', $driverId, $job, $excludeAssignmentId)->exists();
    }

    public static function hasVehicleConflict(int $vehicleId, JobOrder $job, ?int $excludeAssignmentId = null): bool
    {
        return self::conflictingAssignments('vehicle_id', $vehicleId, $job, $excludeAssignmentId)->exists();
    }

    public static function conflictingAssignments(string $column, int $resourceId, JobOrder $job, ?int $excludeAssignmentId = null)
    {
        $query = self::activeAssignmentQuery()->where($column, $resourceId);

        if ($excludeAssignmentId) {
            $query->where('id', '!=', $excludeAssignmentId);
        }

        $window = self::jobWindow($job);

        if ($window === null) {
            // No schedule on new job: block if resource has any active assignment without a future-only window
            return $query->whereHas('jobOrder', function ($q) {
                $q->where(function ($inner) {
                    $inner->whereNull('scheduled_start')
                        ->orWhereNull('scheduled_end')
                        ->orWhere('scheduled_end', '>=', now());
                });
            });
        }

        [$start, $end] = $window;

        return $query->whereHas('jobOrder', function ($q) use ($start, $end) {
            $q->where(function ($inner) use ($start, $end) {
                $inner->where(function ($noSchedule) {
                    $noSchedule->whereNull('scheduled_start')
                        ->orWhereNull('scheduled_end');
                })->orWhere(function ($overlap) use ($start, $end) {
                    $overlap->whereNotNull('scheduled_start')
                        ->whereNotNull('scheduled_end')
                        ->where('scheduled_start', '<', $end)
                        ->where('scheduled_end', '>', $start);
                });
            });
        });
    }

    /**
     * @return array{0: Carbon, 1: Carbon}|null
     */
    public static function jobWindow(JobOrder $job): ?array
    {
        if ($job->scheduled_start && $job->scheduled_end) {
            return [$job->scheduled_start, $job->scheduled_end];
        }

        if ($job->scheduled_start) {
            $start = $job->scheduled_start;
            $end = $job->scheduled_end ?? $start->copy()->addHours(4);

            return [$start, $end];
        }

        return null;
    }
}
