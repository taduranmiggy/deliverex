<?php

namespace App\Services\Reports;

use App\Models\DispatchAssignment;
use App\Support\DeliveryStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class DeliveriesReportQuery
{
    /** @return array{query: Builder, filters: array<string, string|null>} */
    public function build(Request $request): array
    {
        $range = ExportDateRange::resolveOptional($request);
        $request = ExportDateRange::mergeIntoRequest($request, $range);

        $dateField = (string) $request->query('date_field', 'assigned_at');
        $allowedDateFields = config('reports.deliveries.date_fields', ['assigned_at']);
        if (! in_array($dateField, $allowedDateFields, true)) {
            abort(422, 'Invalid date_field');
        }

        $query = DispatchAssignment::query()
            ->with(['jobOrder.company', 'driver.user', 'vehicle', 'assignedBy']);

        $filters = [
            'status' => $request->query('status'),
            'date_field' => $dateField,
            'from' => $range['from'],
            'to' => $range['to'],
            'all_records' => $range['all_records'] ? 'yes' : null,
            'driver_id' => $request->query('driver_id'),
            'vehicle_id' => $request->query('vehicle_id'),
            'company_id' => $request->query('company_id'),
            'sort' => $request->query('sort', 'assigned_at'),
            'sort_dir' => strtolower((string) $request->query('sort_dir', 'desc')),
        ];

        if ($filters['status']) {
            $query->where('status', $filters['status']);
        }

        if ($filters['driver_id']) {
            $query->where('driver_id', (int) $filters['driver_id']);
        }

        if ($filters['vehicle_id']) {
            $query->where('vehicle_id', (int) $filters['vehicle_id']);
        }

        if ($filters['company_id']) {
            $query->whereHas('jobOrder', fn (Builder $q) => $q->where('company_id', (int) $filters['company_id']));
        }

        if (! $range['all_records'] && ($range['from'] || $range['to'])) {
            ExportDateRange::applyToQuery($query, $dateField, $range['from'], $range['to']);
        }

        $sortField = (string) $filters['sort'];
        $sortDir = $filters['sort_dir'] === 'asc' ? 'asc' : 'desc';
        $allowedSort = config('reports.deliveries.sort_fields', ['assigned_at']);
        if (! in_array($sortField, $allowedSort, true)) {
            $sortField = 'assigned_at';
        }

        $query->reorder()->orderBy($sortField, $sortDir);

        return ['query' => $query, 'filters' => $filters];
    }

    /** @return array<string, mixed> */
    public function formatRow(DispatchAssignment $assignment): array
    {
        $job = $assignment->jobOrder;

        return [
            'assignment_id' => $assignment->id,
            'tracking_code' => $job?->tracking_code,
            'job_order_id' => $assignment->job_order_id,
            'client' => $job?->customer_name ?? '—',
            'company' => $job?->company?->company_name ?? '—',
            'driver' => $assignment->driver?->user?->name ?? $assignment->driver?->full_name ?? '—',
            'vehicle' => $assignment->vehicle?->plate_no ?? '—',
            'status' => DeliveryStatus::canonicalize($assignment->status) ?? $assignment->status,
            'dispatcher' => $assignment->assignedBy?->name ?? '—',
            'assigned_at' => $assignment->assigned_at?->timezone(config('reports.default_timezone'))->format('Y-m-d H:i'),
            'started_at' => $assignment->started_at?->timezone(config('reports.default_timezone'))->format('Y-m-d H:i'),
            'completed_at' => $assignment->completed_at?->timezone(config('reports.default_timezone'))->format('Y-m-d H:i'),
            'dropoff' => $job?->dropoff_location ?? '—',
        ];
    }

    /** @return list<string> */
    public function headers(): array
    {
        return [
            'Assignment ID',
            'Tracking Code',
            'Job Order ID',
            'Client',
            'Company',
            'Driver',
            'Vehicle',
            'Status',
            'Dispatcher',
            'Assigned At',
            'Started At',
            'Completed At',
            'Destination',
        ];
    }

    /** @param  array<string, mixed>  $row */
    public function rowValues(array $row): array
    {
        return [
            $row['assignment_id'],
            $row['tracking_code'] ?? '—',
            $row['job_order_id'],
            $row['client'],
            $row['company'],
            $row['driver'],
            $row['vehicle'],
            $row['status'],
            $row['dispatcher'],
            $row['assigned_at'] ?? '—',
            $row['started_at'] ?? '—',
            $row['completed_at'] ?? '—',
            $row['dropoff'],
        ];
    }
}
