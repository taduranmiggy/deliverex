<?php

namespace App\Services\Reports;

use App\Models\OcrResult;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class OcrReportQuery
{
    /** @return array{query: Builder, filters: array<string, mixed>} */
    public function build(Request $request): array
    {
        $range = ExportDateRange::resolve($request, defaultDays: 30);
        $query = OcrResult::query()->orderByDesc('created_at');

        $filters = [
            'filter' => (string) $request->query('filter', 'all'),
            'status' => (string) $request->query('status', 'all'),
            'job_order_id' => $request->query('job_order_id'),
            'date_from' => $range['from'],
            'date_to' => $range['to'],
            'all_records' => $range['all_records'],
        ];

        $this->applyFilters($query, $request, $range, applyDefaultRange: true);

        return ['query' => $query, 'filters' => $filters, 'date_range' => $range['label']];
    }

    /** @param  Builder<OcrResult>  $query */
    public function applyFilters(Builder $query, Request $request, ?array $range = null, bool $applyDefaultRange = false): void
    {
        if ($range === null) {
            $allRecords = filter_var($request->query('all_records', false), FILTER_VALIDATE_BOOLEAN);
            $from = $request->query('from') ?: $request->query('date_from');
            $to = $request->query('to') ?: $request->query('date_to');
            $preset = $request->query('date_preset');

            if ($applyDefaultRange && ! $allRecords && ! $from && ! $to && (! $preset || $preset === 'custom')) {
                $range = ExportDateRange::resolve($request, defaultDays: 30);
            } else {
                $range = [
                    'from' => $from ? (string) $from : null,
                    'to' => $to ? (string) $to : null,
                    'all_records' => $allRecords,
                ];
            }
        }

        $filter = (string) $request->query('filter', 'all');
        $status = (string) $request->query('status', 'all');
        $jobOrderId = trim((string) $request->query('job_order_id', ''));

        switch ($filter) {
            case 'waiting':
                $query->whereIn('processing_status', ['pending', 'processing', 'processed', 'completed'])
                    ->where('review_status', 'pending_review');
                break;
            case 'validated':
                $query->where('review_status', 'verified');
                break;
            case 'flagged':
                $query->whereIn('review_status', ['flagged', 'rejected']);
                break;
            default:
                break;
        }

        if ($status !== '' && $status !== 'all') {
            $query->where('review_status', $status);
        }

        if ($jobOrderId !== '') {
            $numeric = (int) preg_replace('/\D+/', '', $jobOrderId);
            if ($numeric > 0) {
                $query->where('job_order_id', $numeric);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if (! $range['all_records'] && ($range['from'] || $range['to'])) {
            ExportDateRange::applyToQuery($query, 'delivery_date', $range['from'], $range['to'], dateOnly: true);
        }
    }
}
