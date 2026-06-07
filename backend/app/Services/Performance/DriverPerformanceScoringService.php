<?php

namespace App\Services\Performance;

use App\Models\DeliveryDelayReport;
use App\Models\DeliveryIssueReport;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\OcrResult;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class DriverPerformanceScoringService
{
    /**
     * @return array{period: array{from: string, to: string}, drivers: Collection, top_performers: Collection, lowest_performers: Collection}
     */
    public function scoreAll(?Carbon $from = null, ?Carbon $to = null, int $rankLimit = 5): array
    {
        $fromDate = $from ?? now()->subDays(30)->startOfDay();
        $toDate   = $to   ?? now()->endOfDay();

        $drivers = Driver::with('user')->get();

        $scored = $drivers->map(fn (Driver $driver) => $this->scoreDriver($driver, $fromDate, $toDate))
            ->filter(fn ($row) => $row['reliability_score'] !== null)
            ->sortByDesc('reliability_score')
            ->values();

        $ranked = $scored->filter(fn ($row) => $row['total_assignments'] > 0)->values();

        return [
            'period' => [
                'from' => $fromDate->toDateString(),
                'to'   => $toDate->toDateString(),
            ],
            'drivers'            => $scored,
            'top_performers'     => $ranked->take($rankLimit)->values(),
            'lowest_performers'  => $ranked->sortBy('reliability_score')->take($rankLimit)->values(),
        ];
    }

    public function scoreDriver(Driver $driver, Carbon $fromDate, Carbon $toDate): array
    {
        $base = DispatchAssignment::where('driver_id', $driver->id)
            ->whereBetween('created_at', [$fromDate, $toDate]);

        $totalAssignments = (clone $base)->count();
        $completed        = (clone $base)->where('status', 'completed')->count();
        $failed           = (clone $base)->where('status', 'cancelled')->count();

        $onTime = (clone $base)
            ->where('status', 'completed')
            ->whereHas('jobOrder', fn ($q) => $q->whereNotNull('scheduled_end'))
            ->whereRaw('dispatch_assignments.completed_at <= (SELECT scheduled_end FROM job_orders WHERE job_orders.id = dispatch_assignments.job_order_id)')
            ->count();

        $onTimePct = $completed > 0 ? round(($onTime / $completed) * 100, 1) : null;

        $delayReports = DeliveryDelayReport::where('driver_id', $driver->id)
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->count();

        $delayRatePct = $totalAssignments > 0
            ? round(($delayReports / $totalAssignments) * 100, 1)
            : 0;

        $issueReports = DeliveryIssueReport::where('driver_id', $driver->id)
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->count();

        $ocrBase = OcrResult::whereHas('document.assignment', fn ($q) => $q->where('driver_id', $driver->id))
            ->whereBetween('created_at', [$fromDate, $toDate]);

        $ocrTotal = (clone $ocrBase)->count();
        $ocrRejected = (clone $ocrBase)
            ->whereIn('processing_status', ['failed'])
            ->count();

        $ocrRejectionPct = $ocrTotal > 0
            ? round(($ocrRejected / $ocrTotal) * 100, 1)
            : 0;

        $ocrAccuracyPct = $ocrTotal > 0
            ? round(100 - $ocrRejectionPct, 1)
            : 100;

        $reliabilityScore = $this->computeReliabilityScore(
            $totalAssignments,
            $onTimePct,
            $delayRatePct,
            $ocrAccuracyPct,
            $issueReports,
            $completed,
        );

        return [
            'id'                 => $driver->id,
            'name'               => $driver->user?->name ?? $driver->full_name ?? '—',
            'reliability_score'  => $reliabilityScore,
            'total_assignments'  => $totalAssignments,
            'breakdown'          => [
                'on_time_pct'          => $onTimePct,
                'delay_rate_pct'       => $delayRatePct,
                'ocr_accuracy_pct'     => $ocrAccuracyPct,
                'ocr_rejection_pct'    => $ocrRejectionPct,
                'issue_reports'        => $issueReports,
                'completed_deliveries' => $completed,
                'failed_deliveries'    => $failed,
            ],
        ];
    }

    private function computeReliabilityScore(
        int $totalAssignments,
        ?float $onTimePct,
        float $delayRatePct,
        float $ocrAccuracyPct,
        int $issueReports,
        int $completed,
    ): ?int {
        if ($totalAssignments === 0) {
            return null;
        }

        $onTimeComponent = $onTimePct ?? ($completed > 0 ? 0 : 75);
        $delayComponent  = max(0, 100 - min(100, $delayRatePct * 2.5));
        $ocrComponent    = max(0, min(100, $ocrAccuracyPct));
        $issueRatePct    = ($issueReports / $totalAssignments) * 100;
        $issueComponent  = max(0, 100 - min(100, $issueRatePct * 5));
        $completionComponent = ($completed / $totalAssignments) * 100;

        return (int) round(
            ($onTimeComponent * 0.35) +
            ($delayComponent * 0.25) +
            ($ocrComponent * 0.20) +
            ($issueComponent * 0.10) +
            ($completionComponent * 0.10)
        );
    }
}
