<?php

namespace App\Services\Reports;

use App\Models\AssignmentAuditTrail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AssignmentAuditReportQuery
{
    /** @return array{query: Builder, filters: array<string, string|null>} */
    public function build(Request $request): array
    {
        $query = AssignmentAuditTrail::query()->with(['jobOrder', 'dispatcher', 'assignment']);

        $filters = [
            'from' => $request->query('from'),
            'to' => $request->query('to'),
            'overrides_only' => $request->boolean('overrides_only') ? 'yes' : null,
            'job_order_id' => $request->query('job_order_id'),
            'sort_dir' => strtolower((string) $request->query('sort_dir', 'desc')),
        ];

        if (! $filters['from'] && ! $filters['to']) {
            $query->where('created_at', '>=', now()->subDays(90));
            $filters['from'] = now()->subDays(90)->toDateString();
            $filters['to'] = now()->toDateString();
        }

        if ($filters['from'] || $filters['to']) {
            try {
                if ($filters['from']) {
                    $query->where('created_at', '>=', Carbon::parse($filters['from'])->startOfDay());
                }
                if ($filters['to']) {
                    $query->where('created_at', '<=', Carbon::parse($filters['to'])->endOfDay());
                }
            } catch (\Throwable) {
                abort(422, 'Invalid date range');
            }
        }

        if ($request->boolean('overrides_only')) {
            $query->where('is_override', true);
        }

        if ($filters['job_order_id']) {
            $query->where('job_order_id', (int) $filters['job_order_id']);
        }

        $query->reorder()->orderBy('created_at', $filters['sort_dir'] === 'asc' ? 'asc' : 'desc');

        return ['query' => $query, 'filters' => $filters];
    }

    /** @return array<string, mixed> */
    public function formatRow(AssignmentAuditTrail $trail): array
    {
        return [
            'when' => $trail->created_at?->timezone(config('reports.default_timezone'))->format('Y-m-d H:i'),
            'dispatcher' => $trail->dispatcher?->name ?? '—',
            'job_order_id' => $trail->job_order_id,
            'tracking_code' => $trail->jobOrder?->tracking_code,
            'client' => $trail->jobOrder?->customer_name ?? '—',
            'recommended_driver' => $trail->recommended_driver_name ?? '—',
            'recommended_vehicle' => $trail->recommended_vehicle_plate ?? '—',
            'assigned_driver' => $trail->assigned_driver_name ?? '—',
            'assigned_vehicle' => $trail->assigned_vehicle_plate ?? '—',
            'override' => $trail->is_override ? 'Yes' : 'No',
            'override_reason' => $trail->override_reason ?? ($trail->is_override ? '—' : 'Matched Best-Fit'),
            'best_fit_score' => $trail->best_fit_score,
        ];
    }

    /** @return list<string> */
    public function headers(): array
    {
        return [
            'When',
            'Dispatcher',
            'Job Order ID',
            'Tracking Code',
            'Client',
            'Best-Fit Driver',
            'Best-Fit Vehicle',
            'Assigned Driver',
            'Assigned Vehicle',
            'Override',
            'Override Reason',
            'Best-Fit Score',
        ];
    }

    /** @param  array<string, mixed>  $row */
    public function rowValues(array $row): array
    {
        return [
            $row['when'],
            $row['dispatcher'],
            $row['job_order_id'],
            $row['tracking_code'] ?? '—',
            $row['client'],
            $row['recommended_driver'],
            $row['recommended_vehicle'],
            $row['assigned_driver'],
            $row['assigned_vehicle'],
            $row['override'],
            $row['override_reason'],
            $row['best_fit_score'] ?? '—',
        ];
    }
}
