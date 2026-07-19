<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use App\Services\Reports\ExportDateRange;
use App\Services\Reports\PdfReportRenderer;
use App\Services\Reports\ReportMetadata;
use App\Services\Reports\ReportSpreadsheetExporter;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\LazyCollection;

class AuditLogExportService
{
    public function __construct(
        private AuditLogQuery $query,
        private AuditLogPresenter $presenter,
        private ReportSpreadsheetExporter $spreadsheet,
        private PdfReportRenderer $pdf,
    ) {
    }

    public function export(Request $request)
    {
        $format = strtolower((string) $request->query('format', 'pdf'));
        if (! in_array($format, ['csv', 'xlsx', 'pdf'], true)) {
            abort(422, 'Invalid export format. Use csv, xlsx, or pdf.');
        }

        $range = ExportDateRange::resolve($request);
        $request = ExportDateRange::mergeIntoRequest($request, $range);

        ['query' => $builder, 'filters' => $filters] = $this->query->build($request);
        $maxRows = (int) config('reports.export_max_rows', 10000);
        $total = min($builder->count(), $maxRows);

        $meta = ReportMetadata::fromRequest(
            $request,
            'audit_logs',
            'Audit Logs Report',
            $filters,
            ['total_records' => $total],
            exportOptions: $this->exportOptions($request),
        );

        $headers = [
            'Timestamp',
            'User',
            'Role',
            'Module',
            'Action',
            'Description',
            'Record ID',
            'IP Address',
            'Browser / User Agent',
            'Status',
        ];

        $rows = LazyCollection::make(function () use ($builder, $maxRows) {
            foreach ($builder->limit($maxRows)->cursor() as $log) {
                yield $this->rowValues($log);
            }
        });

        AuditLogger::record($request->user(), 'reports.export_'.$format, null, null, [
            'report_type' => 'audit_logs',
            'format' => $format,
            'filters' => $filters,
        ], $request);

        $filename = $meta->fileSlug().'.'.$format;

        if ($format === 'pdf') {
            return $this->pdf->render($meta, $headers, $rows->all(), $filename);
        }

        if ($format === 'xlsx') {
            return $this->spreadsheet->toXlsx($meta, $headers, $rows, $filename);
        }

        return $this->spreadsheet->toCsv($meta, $headers, $rows, $filename);
    }

    /** @return array<string, bool> */
    private function exportOptions(Request $request): array
    {
        $defaults = [
            'include_logo' => true,
            'include_page_numbers' => true,
            'include_generated_by' => true,
            'include_timestamp' => true,
            'include_filters_summary' => true,
            'include_company' => true,
            'include_signature' => false,
            'include_watermark' => false,
        ];

        $resolved = [];
        foreach ($defaults as $key => $default) {
            $resolved[$key] = $request->has($key)
                ? filter_var($request->query($key), FILTER_VALIDATE_BOOLEAN)
                : $default;
        }

        return $resolved;
    }

    /** @return list<string|null> */
    private function rowValues(AuditLog $log): array
    {
        $presented = $this->presenter->present($log);

        return [
            $presented['timestamp']
                ? \Illuminate\Support\Carbon::parse($presented['timestamp'])->timezone(config('app.timezone'))->format('Y-m-d H:i:s')
                : '—',
            $presented['user'] ?? '—',
            $presented['role'] ?? '—',
            $presented['module'] ?? '—',
            $this->presenter->readableAction($presented['action'] ?? ''),
            $presented['description'] ?? $presented['details'] ?? '—',
            $presented['subject_id'] ?? '—',
            $presented['ip_address'] ?? '—',
            $presented['user_agent'] ? mb_substr((string) $presented['user_agent'], 0, 100) : '—',
            ucfirst((string) ($presented['status'] ?? 'success')),
        ];
    }
}
