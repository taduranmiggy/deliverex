<?php

namespace App\Services\Performance;

use App\Models\AssignmentAuditTrail;
use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryDelayReport;
use App\Models\DeliveryIssueReport;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ManagerDashboardMetricsService
{
    /**
     * @return array{
     *   period: array{from: string, to: string},
     *   on_time_pct: float|null,
     *   delivery_completion_pct: float|null,
     *   avg_delivery_time_hours: float|null,
     *   driver_utilization_pct: float|null,
     *   pod_completion_pct: float|null,
     *   exception_rate_pct: float|null,
     * }
     */
    public function compute(?Carbon $from = null, ?Carbon $to = null): array
    {
        $fromDate   = $from ?? now()->subDays(30)->startOfDay();
        $toDate     = $to   ?? now()->endOfDay();
        $periodDays = max(1, (int) $fromDate->copy()->startOfDay()->diffInDays($toDate->copy()->startOfDay()) + 1);

        $assignmentBase = DispatchAssignment::query()
            ->whereBetween('created_at', [$fromDate, $toDate]);

        $totalAssignments = (clone $assignmentBase)->count();
        $completedAssignments = (clone $assignmentBase)->where('status', 'completed')->count();

        $deliveryCompletionPct = $totalAssignments > 0
            ? round(($completedAssignments / $totalAssignments) * 100, 1)
            : null;

        $onTimePct = $this->computeOnTimePct($fromDate, $toDate);
        $avgDeliveryTimeHours = $this->computeAvgDeliveryTimeHours($fromDate, $toDate);
        $driverUtilizationPct = $this->computeDriverUtilizationPct($fromDate, $toDate, $periodDays);
        $podCompletionPct = $this->computePodCompletionPct($fromDate, $toDate);
        $exceptionRatePct = $this->computeExceptionRatePct($fromDate, $toDate, $totalAssignments);

        return [
            'period' => [
                'from' => $fromDate->toDateString(),
                'to'   => $toDate->toDateString(),
            ],
            'on_time_pct'                 => $onTimePct,
            'delivery_completion_pct'     => $deliveryCompletionPct,
            'avg_delivery_time_hours'     => $avgDeliveryTimeHours,
            'driver_utilization_pct'      => $driverUtilizationPct,
            'pod_completion_pct'          => $podCompletionPct,
            'exception_rate_pct'          => $exceptionRatePct,
        ];
    }

    private function computeOnTimePct(Carbon $fromDate, Carbon $toDate): ?float
    {
        $eligibleCompleted = DispatchAssignment::query()
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->whereHas('jobOrder', fn ($q) => $q->whereNotNull('scheduled_end'))
            ->count();

        if ($eligibleCompleted === 0) {
            return null;
        }

        $onTime = DispatchAssignment::query()
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->whereHas('jobOrder', fn ($q) => $q->whereNotNull('scheduled_end'))
            ->whereRaw('dispatch_assignments.completed_at <= (SELECT scheduled_end FROM job_orders WHERE job_orders.id = dispatch_assignments.job_order_id)')
            ->count();

        return round(($onTime / $eligibleCompleted) * 100, 1);
    }

    private function computeAvgDeliveryTimeHours(Carbon $fromDate, Carbon $toDate): ?float
    {
        $completed = DispatchAssignment::query()
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->whereNotNull('started_at')
            ->whereNotNull('completed_at')
            ->get(['started_at', 'completed_at']);

        if ($completed->isEmpty()) {
            return null;
        }

        $avgMinutes = $completed->avg(
            fn (DispatchAssignment $assignment) => $assignment->started_at->diffInMinutes($assignment->completed_at)
        );

        return round(((float) $avgMinutes) / 60, 1);
    }

    private function computeDriverUtilizationPct(Carbon $fromDate, Carbon $toDate, int $periodDays): ?float
    {
        $drivers = Driver::query()->get();
        if ($drivers->isEmpty()) {
            return null;
        }

        $utilizationValues = $drivers->map(function (Driver $driver) use ($fromDate, $toDate, $periodDays) {
            $assignments = DispatchAssignment::query()
                ->where('driver_id', $driver->id)
                ->whereNotIn('status', ['cancelled'])
                ->where(function ($q) use ($fromDate, $toDate) {
                    $q->whereBetween('assigned_at', [$fromDate, $toDate])
                        ->orWhereBetween('completed_at', [$fromDate, $toDate])
                        ->orWhere(function ($inner) use ($fromDate, $toDate) {
                            $inner->where('assigned_at', '<=', $toDate)
                                ->where(function ($w) use ($fromDate) {
                                    $w->whereNull('completed_at')
                                        ->orWhere('completed_at', '>=', $fromDate);
                                });
                        });
                })
                ->get();

            $activeDaysSet = [];

            foreach ($assignments as $assignment) {
                $start = $assignment->started_at
                    ?? $assignment->assigned_at
                    ?? $assignment->created_at;

                if (! $start) {
                    continue;
                }

                $end = $assignment->completed_at;
                if (! $end && ! in_array($assignment->status, ['completed', 'cancelled'], true)) {
                    $end = now()->lessThan($toDate) ? now() : $toDate->copy();
                }
                $end = $end ?? $assignment->updated_at ?? $start;

                $start = $start->copy()->max($fromDate);
                $end   = $end->copy()->min($toDate);

                if ($end->lessThan($start)) {
                    continue;
                }

                $cursor  = $start->copy()->startOfDay();
                $lastDay = $end->copy()->startOfDay();
                while ($cursor->lessThanOrEqualTo($lastDay)) {
                    $activeDaysSet[$cursor->toDateString()] = true;
                    $cursor->addDay();
                }
            }

            $activeDays = count($activeDaysSet);

            return round(($activeDays / $periodDays) * 100, 1);
        });

        return round($utilizationValues->avg(), 1);
    }

    private function computePodCompletionPct(Carbon $fromDate, Carbon $toDate): ?float
    {
        $completedBase = DispatchAssignment::query()
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$fromDate, $toDate]);

        $completedCount = (clone $completedBase)->count();
        if ($completedCount === 0) {
            return null;
        }

        $withProof = (clone $completedBase)
            ->where(function ($q) {
                $q->whereNotNull('pod_verified_at')
                    ->orWhereExists(function ($sub) {
                        $sub->select(DB::raw(1))
                            ->from('delivery_completion_proofs')
                            ->whereColumn('delivery_completion_proofs.assignment_id', 'dispatch_assignments.id');
                    });
            })
            ->count();

        return round(($withProof / $completedCount) * 100, 1);
    }

    private function computeExceptionRatePct(Carbon $fromDate, Carbon $toDate, int $totalAssignments): ?float
    {
        if ($totalAssignments === 0) {
            return null;
        }

        $delayReports = DeliveryDelayReport::query()
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->count();

        $issueReports = DeliveryIssueReport::query()
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->count();

        return round((($delayReports + $issueReports) / $totalAssignments) * 100, 1);
    }
}
