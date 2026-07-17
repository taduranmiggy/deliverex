<?php

namespace App\Services\Performance;

use App\Models\AssignmentAuditTrail;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Support\DeliveryStatus;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ManagerDashboardMetricsService
{
    /**
     * @return array{
     *   period: array{from: string, to: string},
     *   on_time_pct: float|null,
     *   on_time_pct_trend: array{delta: float|null, direction: string|null},
     *   delivery_completion_pct: float|null,
     *   delivery_completion_pct_trend: array{delta: float|null, direction: string|null},
     *   avg_delivery_time_hours: float|null,
     *   avg_delivery_time_hours_trend: array{delta: float|null, direction: string|null},
     *   driver_utilization_pct: float|null,
     *   driver_utilization_pct_trend: array{delta: float|null, direction: string|null},
     *   best_fit_efficiency_score: float|null,
     *   best_fit_efficiency_score_trend: array{delta: float|null, direction: string|null},
     *   pod_completion_pct: float|null,
     *   pod_completion_pct_trend: array{delta: float|null, direction: string|null},
     *   exception_rate_pct: float|null,
     *   exception_rate_pct_trend: array{delta: float|null, direction: string|null},
     * }
     */
    public function compute(?Carbon $from = null, ?Carbon $to = null): array
    {
        $fromDate = ($from ?? now()->subDays(30))->copy()->startOfDay();
        $toDate   = ($to ?? now())->copy()->endOfDay();

        $current = $this->computeSnapshot($fromDate, $toDate);
        $previous = $this->previousPeriod($fromDate, $toDate);
        $prior = $this->computeSnapshot($previous['from'], $previous['to']);

        return [
            'period' => [
                'from' => $fromDate->toDateString(),
                'to'   => $toDate->toDateString(),
            ],
            'on_time_pct'               => $current['on_time_pct'],
            'on_time_pct_trend'         => $this->trend($current['on_time_pct'], $prior['on_time_pct'], higherIsBetter: true),
            'delivery_completion_pct'     => $current['delivery_completion_pct'],
            'delivery_completion_pct_trend' => $this->trend($current['delivery_completion_pct'], $prior['delivery_completion_pct'], higherIsBetter: true),
            'avg_delivery_time_hours'     => $current['avg_delivery_time_hours'],
            'avg_delivery_time_hours_trend' => $this->trend($current['avg_delivery_time_hours'], $prior['avg_delivery_time_hours'], higherIsBetter: false),
            'driver_utilization_pct'      => $current['driver_utilization_pct'],
            'driver_utilization_pct_trend' => $this->trend($current['driver_utilization_pct'], $prior['driver_utilization_pct'], higherIsBetter: true),
            'best_fit_efficiency_score'   => $current['best_fit_efficiency_score'],
            'best_fit_efficiency_score_trend' => $this->trend($current['best_fit_efficiency_score'], $prior['best_fit_efficiency_score'], higherIsBetter: true),
            'pod_completion_pct'          => $current['pod_completion_pct'],
            'pod_completion_pct_trend'    => $this->trend($current['pod_completion_pct'], $prior['pod_completion_pct'], higherIsBetter: true),
            'exception_rate_pct'          => $current['exception_rate_pct'],
            'exception_rate_pct_trend'    => $this->trend($current['exception_rate_pct'], $prior['exception_rate_pct'], higherIsBetter: false),
        ];
    }

    /**
     * @return array{
     *   on_time_pct: float|null,
     *   delivery_completion_pct: float|null,
     *   avg_delivery_time_hours: float|null,
     *   driver_utilization_pct: float|null,
     *   best_fit_efficiency_score: float|null,
     *   pod_completion_pct: float|null,
     *   exception_rate_pct: float|null,
     * }
     */
    private function computeSnapshot(Carbon $fromDate, Carbon $toDate): array
    {
        return [
            'on_time_pct'               => $this->computeOnTimePct($fromDate, $toDate),
            'delivery_completion_pct'   => $this->computeDeliveryCompletionPct($fromDate, $toDate),
            'avg_delivery_time_hours'   => $this->computeAvgDeliveryTimeHours($fromDate, $toDate),
            'driver_utilization_pct'    => $this->computeDriverUtilizationPct($fromDate, $toDate),
            'best_fit_efficiency_score' => $this->computeBestFitEfficiencyScore($fromDate, $toDate),
            'pod_completion_pct'        => $this->computePodCompletionPct($fromDate, $toDate),
            'exception_rate_pct'        => $this->computeExceptionRatePct($fromDate, $toDate),
        ];
    }

    /**
     * On-Time Delivery Rate = completed on time / total completed deliveries × 100
     * (only deliveries with a scheduled_end are eligible)
     */
    private function computeOnTimePct(Carbon $fromDate, Carbon $toDate): ?float
    {
        $eligibleCompleted = DispatchAssignment::query()
            ->where('status', DeliveryStatus::COMPLETED)
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->whereHas('jobOrder', fn ($q) => $q->whereNotNull('scheduled_end'))
            ->count();

        if ($eligibleCompleted === 0) {
            return null;
        }

        $onTime = DispatchAssignment::query()
            ->where('status', DeliveryStatus::COMPLETED)
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->whereHas('jobOrder', fn ($q) => $q->whereNotNull('scheduled_end'))
            ->whereRaw('dispatch_assignments.completed_at <= (SELECT scheduled_end FROM job_orders WHERE job_orders.id = dispatch_assignments.job_order_id)')
            ->count();

        return self::clampPct(($onTime / $eligibleCompleted) * 100);
    }

    /**
     * Delivery Completion Rate = completed job orders / total job orders × 100
     */
    private function computeDeliveryCompletionPct(Carbon $fromDate, Carbon $toDate): ?float
    {
        $jobBase = JobOrder::query()->whereBetween('created_at', [$fromDate, $toDate]);
        $totalJobs = (clone $jobBase)->count();

        if ($totalJobs === 0) {
            return null;
        }

        $completedJobs = (clone $jobBase)->where('status', 'completed')->count();

        return self::clampPct(($completedJobs / $totalJobs) * 100);
    }

    /**
     * Average Delivery Time = avg(completed_at − dispatch_time)
     * dispatch_time uses assigned_at, falling back to started_at.
     */
    private function computeAvgDeliveryTimeHours(Carbon $fromDate, Carbon $toDate): ?float
    {
        $completed = DispatchAssignment::query()
            ->where('status', DeliveryStatus::COMPLETED)
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->whereNotNull('completed_at')
            ->where(function ($q) {
                $q->whereNotNull('assigned_at')->orWhereNotNull('started_at');
            })
            ->get(['assigned_at', 'started_at', 'completed_at']);

        if ($completed->isEmpty()) {
            return null;
        }

        $avgMinutes = $completed->avg(function (DispatchAssignment $assignment) {
            $dispatchAt = $assignment->assigned_at ?? $assignment->started_at;
            if (! $dispatchAt || ! $assignment->completed_at) {
                return null;
            }

            return max(0, $dispatchAt->diffInMinutes($assignment->completed_at));
        });

        if ($avgMinutes === null || ! is_finite((float) $avgMinutes)) {
            return null;
        }

        return round(max(0, ((float) $avgMinutes) / 60), 1);
    }

    /**
     * Driver Utilization = drivers with assignments in period / available drivers × 100
     */
    private function computeDriverUtilizationPct(Carbon $fromDate, Carbon $toDate): ?float
    {
        $availableDrivers = Driver::query()
            ->whereIn('availability', ['available', 'busy'])
            ->count();

        if ($availableDrivers === 0) {
            return null;
        }

        $activeDriverIds = DispatchAssignment::query()
            ->whereNotIn('status', [DeliveryStatus::CANCELLED, 'rejected', 'canceled'])
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
            ->whereNotNull('driver_id')
            ->distinct()
            ->count('driver_id');

        return self::clampPct(($activeDriverIds / $availableDrivers) * 100);
    }

    /**
     * Best-Fit Assignment Efficiency = average best_fit_score of accepted dispatches
     */
    private function computeBestFitEfficiencyScore(Carbon $fromDate, Carbon $toDate): ?float
    {
        $avgScore = AssignmentAuditTrail::query()
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->whereNotNull('best_fit_score')
            ->whereNotNull('assigned_driver_id')
            ->avg('best_fit_score');

        if ($avgScore === null) {
            return null;
        }

        return round(min(100, max(0, (float) $avgScore)), 1);
    }

    /**
     * PoD Completion Rate = completed deliveries with proof / completed deliveries × 100
     */
    private function computePodCompletionPct(Carbon $fromDate, Carbon $toDate): ?float
    {
        $completedBase = DispatchAssignment::query()
            ->where('status', DeliveryStatus::COMPLETED)
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

        return self::clampPct(($withProof / $completedCount) * 100);
    }

    /**
     * Exception Rate = (delayed + cancelled + failed) / total deliveries × 100
     * Each assignment is counted at most once.
     */
    private function computeExceptionRatePct(Carbon $fromDate, Carbon $toDate): ?float
    {
        $totalDeliveries = DispatchAssignment::query()
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->count();

        if ($totalDeliveries === 0) {
            return null;
        }

        $terminalBad = [DeliveryStatus::CANCELLED, 'rejected', 'canceled', 'failed'];

        $exceptionCount = DispatchAssignment::query()
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->where(function ($q) use ($terminalBad) {
                $q->whereIn('status', $terminalBad)
                    ->orWhere(function ($lateCompleted) {
                        $lateCompleted
                            ->where('status', DeliveryStatus::COMPLETED)
                            ->whereNotNull('completed_at')
                            ->whereRaw(
                                'dispatch_assignments.completed_at > (SELECT scheduled_end FROM job_orders WHERE job_orders.id = dispatch_assignments.job_order_id AND scheduled_end IS NOT NULL)'
                            );
                    })
                    ->orWhere(function ($overdueActive) {
                        DeliveryStatus::applyAvailabilityBlockingScope($overdueActive)
                            ->whereHas('jobOrder', fn ($j) => $j
                                ->whereNotNull('scheduled_end')
                                ->where('scheduled_end', '<', now()));
                    });
            })
            ->count();

        return self::clampPct(($exceptionCount / $totalDeliveries) * 100);
    }

    /**
     * @return array{from: Carbon, to: Carbon}
     */
    private function previousPeriod(Carbon $fromDate, Carbon $toDate): array
    {
        $periodDays = max(1, (int) $fromDate->copy()->startOfDay()->diffInDays($toDate->copy()->startOfDay()) + 1);
        $prevTo = $fromDate->copy()->subDay()->endOfDay();
        $prevFrom = $prevTo->copy()->subDays($periodDays - 1)->startOfDay();

        return ['from' => $prevFrom, 'to' => $prevTo];
    }

    /**
     * @return array{delta: float|null, direction: string|null}
     */
    private function trend(?float $current, ?float $previous, bool $higherIsBetter): array
    {
        if ($current === null || $previous === null) {
            return ['delta' => null, 'direction' => null];
        }

        $delta = round($current - $previous, 1);
        if (abs($delta) < 0.05) {
            return ['delta' => 0.0, 'direction' => 'flat'];
        }

        $improved = $higherIsBetter ? $delta > 0 : $delta < 0;

        return [
            'delta'     => abs($delta),
            'direction' => $improved ? 'up' : 'down',
        ];
    }

    public static function clampPct(float $value): float
    {
        if (! is_finite($value)) {
            return 0.0;
        }

        return round(min(100, max(0, $value)), 1);
    }
}
