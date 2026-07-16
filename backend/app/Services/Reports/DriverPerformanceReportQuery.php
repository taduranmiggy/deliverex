<?php

namespace App\Services\Reports;

use App\Services\Performance\DriverPerformanceScoringService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DriverPerformanceReportQuery
{
    public function __construct(private DriverPerformanceScoringService $scoringService)
    {
    }

    /**
     * @return array{rows: list<array<string, mixed>>, filters: array<string, string|null>, summary: array<string, mixed>}
     */
    public function build(Request $request): array
    {
        $from = $request->query('from');
        $to = $request->query('to');

        $fromDate = $from ? Carbon::parse($from)->startOfDay() : now()->subDays(30)->startOfDay();
        $toDate = $to ? Carbon::parse($to)->endOfDay() : now()->endOfDay();

        $filters = [
            'from' => $fromDate->toDateString(),
            'to' => $toDate->toDateString(),
            'sort' => $request->query('sort', 'reliability_score'),
            'sort_dir' => strtolower((string) $request->query('sort_dir', 'desc')),
        ];

        $scored = $this->scoringService->scoreAll($fromDate, $toDate, 5);
        $rows = $scored['drivers']->map(function (array $row) {
            $total = (int) ($row['total_assignments'] ?? 0);
            $completed = (int) ($row['breakdown']['completed_deliveries'] ?? 0);

            return [
                'driver_id' => $row['id'],
                'driver' => $row['name'],
                'reliability_score' => $row['reliability_score'],
                'total_jobs' => $total,
                'completed' => $completed,
                'completion_pct' => $total > 0 ? round(($completed / $total) * 100, 1) : null,
                'on_time_pct' => $row['breakdown']['on_time_pct'] ?? null,
                'delay_rate_pct' => $row['breakdown']['delay_rate_pct'] ?? null,
                'ocr_accuracy_pct' => $row['breakdown']['ocr_accuracy_pct'] ?? null,
                'issue_reports' => $row['breakdown']['issue_reports'] ?? 0,
            ];
        });

        $sortField = (string) $filters['sort'];
        $desc = $filters['sort_dir'] !== 'asc';
        $rows = $rows->sortBy($sortField, SORT_REGULAR, $desc)->values()->all();

        $summary = [
            'drivers' => count($rows),
            'avg_reliability' => count($rows) > 0
                ? round(collect($rows)->avg('reliability_score'), 1)
                : null,
        ];

        return ['rows' => $rows, 'filters' => $filters, 'summary' => $summary];
    }

    /** @return list<string> */
    public function headers(): array
    {
        return [
            'Driver',
            'Reliability Score',
            'Total Jobs',
            'Completed',
            'Completion %',
            'On-Time %',
            'Delay Rate %',
            'OCR Accuracy %',
            'Issue Reports',
        ];
    }

    /** @param  array<string, mixed>  $row */
    public function rowValues(array $row): array
    {
        return [
            $row['driver'],
            $row['reliability_score'],
            $row['total_jobs'],
            $row['completed'],
            $row['completion_pct'] !== null ? $row['completion_pct'].'%' : '—',
            $row['on_time_pct'] !== null ? $row['on_time_pct'].'%' : '—',
            $row['delay_rate_pct'] !== null ? $row['delay_rate_pct'].'%' : '—',
            $row['ocr_accuracy_pct'] !== null ? $row['ocr_accuracy_pct'].'%' : '—',
            $row['issue_reports'],
        ];
    }
}
