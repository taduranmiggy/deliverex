<?php

namespace App\Services\Reports;

use App\Models\AuditLog;
use App\Models\ChatbotInteraction;
use App\Models\Company;
use App\Models\Driver;
use App\Models\EmailLog;
use App\Models\Inquiry;
use App\Models\JobOrder;
use App\Models\NotificationLog;
use App\Models\OcrResult;
use App\Models\TrackingLog;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Central catalog for enterprise tabular reports.
 *
 * New report types are added here and automatically inherit the shared PDF,
 * spreadsheet, branding, metadata, pagination, and audit-export behavior.
 */
class EnterpriseReportQuery
{
    /** @return list<string> */
    public function supportedTypes(): array
    {
        return [
            'job_orders', 'tracking', 'ocr_reviews', 'notifications', 'analytics',
            'email_monitoring', 'system_logs', 'drivers', 'vehicles', 'customers',
            'support_inquiries', 'chatbox',
        ];
    }

    /** @return array{title: string, headers: list<string>, rows: list<list<mixed>>, filters: array<string, mixed>, summary: array<string, mixed>} */
    public function build(Request $request, string $type): array
    {
        if (! in_array($type, $this->supportedTypes(), true)) {
            abort(422, 'Unsupported report type.');
        }

        $range = ExportDateRange::resolve($request);
        $filters = $this->filters($request, $range);
        $maxRows = (int) config('reports.export_max_rows', 10000);

        return match ($type) {
            'job_orders' => $this->jobOrders($request, $filters, $range, $maxRows),
            'tracking' => $this->tracking($request, $filters, $range, $maxRows),
            'ocr_reviews' => $this->ocrReviews($request, $filters, $range, $maxRows),
            'notifications' => $this->notifications($request, $filters, $range, $maxRows),
            'analytics' => $this->analytics($request, $filters, $range, $maxRows),
            'email_monitoring' => $this->emailMonitoring($request, $filters, $range, $maxRows),
            'system_logs' => $this->systemLogs($request, $filters, $range, $maxRows),
            'drivers' => $this->drivers($request, $filters, $range, $maxRows),
            'vehicles' => $this->vehicles($request, $filters, $range, $maxRows),
            'customers' => $this->customers($request, $filters, $range, $maxRows),
            'support_inquiries' => $this->supportInquiries($request, $filters, $range, $maxRows),
            'chatbox' => $this->chatbox($request, $filters, $range, $maxRows),
        };
    }

    private function jobOrders(Request $request, array $filters, array $range, int $limit): array
    {
        $query = JobOrder::query()->with('company', 'materialTypeRef')->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', [
            'tracking_code', 'customer_name', 'custom_client_name', 'pickup_location', 'dropoff_location',
        ]);
        $models = $query->limit($limit)->get();

        return $this->result('Job Orders Report', [
            'Record ID', 'Tracking Code', 'Customer / Company', 'Pickup', 'Drop-off',
            'Material', 'Volume (m3)', 'Status', 'Scheduled Start', 'Created On',
        ], $models->map(fn (JobOrder $job) => [
            $job->id,
            $job->tracking_code ?: '-',
            $job->display_name ?: '-',
            $job->display_pickup ?: '-',
            $job->display_dropoff ?: '-',
            $job->materialTypeRef?->name ?? $job->material_type ?? '-',
            $job->load_volume_m3 ?? $job->volume_m3 ?? '-',
            $job->status ?: '-',
            $this->date($job->scheduled_start),
            $this->date($job->created_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function tracking(Request $request, array $filters, array $range, int $limit): array
    {
        $query = TrackingLog::query()->with('assignment.jobOrder', 'driver.user')->orderByDesc('captured_at');
        $this->applyCommon($query, $request, $range, 'captured_at', null, ['source']);
        $models = $query->limit($limit)->get();

        return $this->result('Tracking Report', [
            'Timestamp', 'Assignment', 'Job Order', 'Driver', 'Latitude', 'Longitude', 'Speed (km/h)', 'Source',
        ], $models->map(fn (TrackingLog $log) => [
            $this->date($log->captured_at),
            $log->assignment_id,
            $log->assignment?->job_order_id ?? '-',
            $log->driver?->user?->name ?? $log->driver?->full_name ?? '-',
            $log->latitude,
            $log->longitude,
            $log->speed_kmh ?? '-',
            $log->source ?? '-',
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function ocrReviews(Request $request, array $filters, array $range, int $limit): array
    {
        $query = OcrResult::query()->with('validator')->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'review_status', [
            'delivery_receipt_number', 'driver_name', 'vehicle_plate_no', 'processing_status', 'review_status',
        ]);
        $models = $query->limit($limit)->get();

        return $this->result('OCR Reviews Report', [
            'Record ID', 'Job Order', 'Receipt No.', 'Driver', 'Vehicle', 'Confidence',
            'Processing Status', 'Review Status', 'Reviewed By', 'Reviewed On',
        ], $models->map(fn (OcrResult $ocr) => [
            $ocr->id,
            $ocr->job_order_id ?? '-',
            $ocr->getEffectiveValue('delivery_receipt_number') ?: '-',
            $ocr->driver_name ?: '-',
            $ocr->vehicle_plate_no ?: '-',
            $ocr->confidence_score !== null ? round((float) $ocr->confidence_score * 100, 1).'%' : '-',
            $ocr->processing_status ?: '-',
            $ocr->review_status ?: '-',
            $ocr->validator?->name ?: '-',
            $this->date($ocr->reviewed_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function notifications(Request $request, array $filters, array $range, int $limit): array
    {
        $query = NotificationLog::query()->with('user')->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', null, ['title', 'message']);
        if (($status = $request->query('status')) && $status !== 'all') {
            $query->where('is_read', $status === 'read');
        }
        $models = $query->limit($limit)->get();

        return $this->result('Notifications Report', [
            'Record ID', 'Recipient', 'Title', 'Message', 'Status', 'Created On',
        ], $models->map(fn (NotificationLog $log) => [
            $log->id,
            $log->user?->name ?? '-',
            $log->title,
            $this->clip($log->message, 180),
            $log->is_read ? 'Read' : 'Unread',
            $this->date($log->created_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function analytics(Request $request, array $filters, array $range, int $limit): array
    {
        $query = JobOrder::query()->orderBy('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', ['tracking_code', 'customer_name']);
        $models = $query->limit($limit)->get(['id', 'status', 'created_at']);
        $rows = $models->groupBy(fn (JobOrder $job) => $job->created_at?->toDateString() ?? 'Unknown')
            ->map(function (Collection $day, string $date) {
                return [
                    $date,
                    $day->count(),
                    $day->where('status', 'completed')->count(),
                    $day->whereIn('status', ['assigned', 'in_progress', 'arrived'])->count(),
                    $day->where('status', 'pending')->count(),
                    $day->where('status', 'cancelled')->count(),
                ];
            })->values();

        return $this->result('Analytics Report', [
            'Date', 'Total Job Orders', 'Completed', 'In Progress', 'Pending', 'Cancelled',
        ], $rows, $filters, [
            'total_job_orders' => $models->count(),
            'completion_rate' => $models->count() > 0
                ? round($models->where('status', 'completed')->count() / $models->count() * 100, 1).'%' : '0%',
        ]);
    }

    private function emailMonitoring(Request $request, array $filters, array $range, int $limit): array
    {
        $query = EmailLog::query()->with('user')->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', ['recipient', 'subject', 'email_type', 'provider']);
        $models = $query->limit($limit)->get();

        return $this->result('Email Monitoring Report', [
            'Record ID', 'Type', 'Recipient', 'Subject', 'Status', 'Attempts', 'Provider', 'Sent On', 'Failure Reason',
        ], $models->map(fn (EmailLog $log) => [
            $log->id,
            $log->email_type,
            $log->recipient,
            $this->clip($log->subject, 100),
            $log->status,
            $log->attempts,
            $log->provider,
            $this->date($log->sent_at),
            $this->clip($log->failure_reason, 120),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function systemLogs(Request $request, array $filters, array $range, int $limit): array
    {
        $query = AuditLog::query()->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', ['user_name', 'module', 'action', 'description', 'ip_address']);
        if (($module = $request->query('module')) && $module !== 'all') {
            $query->where('module', $module);
        }
        $models = $query->limit($limit)->get();

        return $this->result('System Logs Report', [
            'Timestamp', 'User', 'Role', 'Module', 'Action', 'Description', 'Record ID', 'IP Address', 'Status',
        ], $models->map(fn (AuditLog $log) => [
            $this->date($log->created_at),
            $log->user_name ?? 'System',
            $log->role_name ?? '-',
            $log->module ?? '-',
            $log->action,
            $this->clip($log->description, 160),
            $log->subject_id ?? '-',
            $log->ip_address ?? '-',
            ucfirst($log->status ?? 'success'),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function drivers(Request $request, array $filters, array $range, int $limit): array
    {
        $query = Driver::query()->with('user')->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', ['full_name', 'license_no', 'availability']);
        $models = $query->limit($limit)->get();

        return $this->result('Drivers Report', [
            'Record ID', 'Driver Name', 'Email', 'License No.', 'License Expiry', 'Availability', 'Status', 'Created On',
        ], $models->map(fn (Driver $driver) => [
            $driver->id,
            $driver->user?->name ?? $driver->full_name ?? '-',
            $driver->user?->email ?? '-',
            $driver->license_no,
            $driver->license_expiry?->format('Y-m-d') ?? '-',
            $driver->availability ?? '-',
            $driver->status ?? '-',
            $this->date($driver->created_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function vehicles(Request $request, array $filters, array $range, int $limit): array
    {
        $query = Vehicle::query()->with('vehicleType')->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', ['plate_no', 'type', 'capacity']);
        $models = $query->limit($limit)->get();

        return $this->result('Vehicles Report', [
            'Record ID', 'Plate No.', 'Vehicle Type', 'Capacity', 'Max Weight (kg)', 'Max Volume (m3)', 'Status', 'Created On',
        ], $models->map(fn (Vehicle $vehicle) => [
            $vehicle->id,
            $vehicle->plate_no,
            $vehicle->vehicleType?->name ?? $vehicle->type ?? '-',
            $vehicle->capacity ?? '-',
            $vehicle->max_weight_kg ?? '-',
            $vehicle->max_volume_m3 ?? '-',
            $vehicle->status ?? '-',
            $this->date($vehicle->created_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function customers(Request $request, array $filters, array $range, int $limit): array
    {
        $query = Company::query()->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', ['company_name', 'company_email', 'contact_person', 'contact_number']);
        $models = $query->limit($limit)->get();

        return $this->result('Customers Report', [
            'Record ID', 'Company / Customer', 'Email', 'Contact Person', 'Contact Number', 'Address', 'Status', 'Created On',
        ], $models->map(fn (Company $company) => [
            $company->id,
            $company->company_name,
            $company->company_email,
            $company->contact_person ?? '-',
            $company->contact_number ?? '-',
            $this->clip($company->address, 130),
            $company->status,
            $this->date($company->created_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function supportInquiries(Request $request, array $filters, array $range, int $limit): array
    {
        $query = Inquiry::query()->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', 'status', ['name', 'email', 'subject', 'reference_no', 'message']);
        $models = $query->limit($limit)->get();

        return $this->result('Support Inquiries Report', [
            'Record ID', 'Reference', 'Customer', 'Email', 'Type', 'Subject', 'Status', 'Submitted On',
        ], $models->map(fn (Inquiry $inquiry) => [
            $inquiry->id,
            $inquiry->reference_no ?? '-',
            $inquiry->name,
            $inquiry->email,
            $inquiry->inquiry_type ?? '-',
            $this->clip($inquiry->subject ?: $inquiry->message, 130),
            $inquiry->status,
            $this->date($inquiry->created_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function chatbox(Request $request, array $filters, array $range, int $limit): array
    {
        $query = ChatbotInteraction::query()->with('user', 'intent')->orderByDesc('created_at');
        $this->applyCommon($query, $request, $range, 'created_at', null, ['session_id', 'user_message']);
        if (($status = $request->query('status')) && $status !== 'all') {
            $query->where('resolved', $status === 'resolved');
        }
        $models = $query->limit($limit)->get();

        return $this->result('Support Chatbox Report', [
            'Record ID', 'Session', 'User', 'Intent', 'Message', 'Status', 'Created On',
        ], $models->map(fn (ChatbotInteraction $interaction) => [
            $interaction->id,
            $interaction->session_id ?? '-',
            $interaction->user?->name ?? 'Guest',
            $interaction->intent?->name ?? 'Unclassified',
            $this->clip($interaction->user_message, 180),
            $interaction->resolved ? 'Resolved' : 'Unresolved',
            $this->date($interaction->created_at),
        ]), $filters, ['total_records' => $models->count()]);
    }

    private function applyCommon(
        Builder $query,
        Request $request,
        array $range,
        string $dateColumn,
        ?string $statusColumn,
        array $searchColumns,
    ): void {
        if (! $range['all_records']) {
            ExportDateRange::applyToQuery($query, $dateColumn, $range['from'], $range['to']);
        }

        $status = trim((string) $request->query('status', ''));
        if ($statusColumn && $status !== '' && $status !== 'all') {
            $query->where($statusColumn, $status);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '' && $searchColumns !== []) {
            $query->where(function (Builder $nested) use ($search, $searchColumns) {
                foreach ($searchColumns as $index => $column) {
                    $method = $index === 0 ? 'where' : 'orWhere';
                    $nested->{$method}($column, 'like', '%'.$search.'%');
                }
            });
        }
    }

    private function filters(Request $request, array $range): array
    {
        return [
            'from' => $range['from'],
            'to' => $range['to'],
            'all_records' => $range['all_records'],
            'module' => $request->query('module'),
            'status' => $request->query('status'),
            'search' => $request->query('search'),
        ];
    }

    private function result(string $title, array $headers, Collection $rows, array $filters, array $summary): array
    {
        return [
            'title' => $title,
            'headers' => $headers,
            'rows' => $rows->values()->all(),
            'filters' => $filters,
            'summary' => $summary,
        ];
    }

    private function date(mixed $value): string
    {
        if (! $value) {
            return '-';
        }

        return Carbon::parse($value)
            ->timezone(config('reports.default_timezone'))
            ->format('Y-m-d H:i');
    }

    private function clip(mixed $value, int $length): string
    {
        $text = trim((string) $value);

        return $text === '' ? '-' : mb_strimwidth($text, 0, $length, '...');
    }
}
