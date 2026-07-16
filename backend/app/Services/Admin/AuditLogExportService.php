<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
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
        $format = strtolower((string) $request->query('format', 'csv'));
        if (! in_array($format, ['csv', 'xlsx', 'pdf'], true)) {
            abort(422, 'Invalid export format. Use csv, xlsx, or pdf.');
        }

        ['query' => $builder, 'filters' => $filters] = $this->query->build($request);
        $maxRows = (int) config('reports.export_max_rows', 10000);
        $total = min($builder->count(), $maxRows);

        $meta = ReportMetadata::fromRequest(
            $request,
            'audit_logs',
            'Audit Logs Report',
            $filters,
            ['total_records' => $total],
        );

        $headers = [
            'Timestamp',
            'User',
            'Email',
            'Role',
            'Action',
            'Readable Action',
            'Module',
            'Details',
            'IP Address',
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

    /** @return list<string|null> */
    private function rowValues(AuditLog $log): array
    {
        $presented = $this->presenter->present($log);

        return [
            $presented['timestamp']
                ? \Illuminate\Support\Carbon::parse($presented['timestamp'])->timezone(config('app.timezone'))->format('Y-m-d H:i:s')
                : '—',
            $presented['user'] ?? '—',
            $presented['user_email'] ?? '—',
            $presented['role'] ?? '—',
            $presented['action'] ?? '—',
            $this->presenter->readableAction($presented['action'] ?? ''),
            $presented['module'] ?? '—',
            $presented['details'] ?? '—',
            $presented['ip_address'] ?? '—',
        ];
    }
}
