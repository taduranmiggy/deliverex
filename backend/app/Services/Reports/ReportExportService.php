<?php

namespace App\Services\Reports;

use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\LazyCollection;

class ReportExportService
{
    public function __construct(
        private DeliveriesReportQuery $deliveriesQuery,
        private AssignmentAuditReportQuery $auditQuery,
        private DriverPerformanceReportQuery $driverPerformanceQuery,
        private ReportSpreadsheetExporter $spreadsheet,
        private PdfReportRenderer $pdf,
    ) {
    }

    public function export(Request $request)
    {
        $type = (string) $request->query('type', 'deliveries');
        $format = strtolower((string) $request->query('format', 'csv'));

        if (! in_array($format, ['csv', 'xlsx', 'pdf'], true)) {
            abort(422, 'Invalid export format. Use csv, xlsx, or pdf.');
        }

        $result = match ($type) {
            'deliveries' => $this->exportDeliveries($request, $format),
            'driver_performance' => $this->exportDriverPerformance($request, $format),
            'assignment_audit' => $this->exportAssignmentAudit($request, $format),
            default => abort(422, 'Unsupported report type.'),
        };

        AuditLogger::record($request->user(), 'reports.export_'.$format, null, null, [
            'report_type' => $type,
            'format' => $format,
            'filters' => $request->query(),
        ], $request);

        return $result;
    }

    private function exportDeliveries(Request $request, string $format)
    {
        ['query' => $query, 'filters' => $filters] = $this->deliveriesQuery->build($request);
        $maxRows = (int) config('reports.export_max_rows', 10000);
        $total = min($query->count(), $maxRows);

        $summary = [
            'total_records' => $total,
            'completed' => (clone $query)->where('status', 'completed')->count(),
            'cancelled' => (clone $query)->where('status', 'cancelled')->count(),
        ];

        $meta = ReportMetadata::fromRequest(
            $request,
            'deliveries',
            'Delivery Report',
            $filters,
            $summary,
        );

        $rows = $this->lazyRows(
            $query->limit($maxRows)->cursor(),
            fn ($model) => $this->deliveriesQuery->rowValues($this->deliveriesQuery->formatRow($model)),
        );

        return $this->respond($format, $meta, $this->deliveriesQuery->headers(), $rows);
    }

    private function exportDriverPerformance(Request $request, string $format)
    {
        ['rows' => $data, 'filters' => $filters, 'summary' => $summary] = $this->driverPerformanceQuery->build($request);

        $meta = ReportMetadata::fromRequest(
            $request,
            'driver_performance',
            'Driver Performance Report',
            $filters,
            $summary,
        );

        $rows = array_map(
            fn (array $row) => $this->driverPerformanceQuery->rowValues($row),
            $data,
        );

        return $this->respond($format, $meta, $this->driverPerformanceQuery->headers(), $rows);
    }

    private function exportAssignmentAudit(Request $request, string $format)
    {
        ['query' => $query, 'filters' => $filters] = $this->auditQuery->build($request);
        $maxRows = (int) config('reports.export_max_rows', 10000);
        $total = min($query->count(), $maxRows);

        $meta = ReportMetadata::fromRequest(
            $request,
            'assignment_audit',
            'Assignment Audit Report',
            $filters,
            [
                'total_records' => $total,
                'overrides' => (clone $query)->where('is_override', true)->count(),
            ],
        );

        $rows = $this->lazyRows(
            $query->limit($maxRows)->cursor(),
            fn ($model) => $this->auditQuery->rowValues($this->auditQuery->formatRow($model)),
        );

        return $this->respond($format, $meta, $this->auditQuery->headers(), $rows);
    }

    /**
     * @param  iterable<list<string|int|float|null>>|LazyCollection  $rows
     */
    private function respond(string $format, ReportMetadata $meta, array $headers, iterable $rows)
    {
        $filename = $meta->fileSlug().'.'.$format;

        if ($format === 'pdf') {
            $materialized = $rows instanceof LazyCollection ? $rows->all() : iterator_to_array($rows);

            return $this->pdf->render($meta, $headers, $materialized, $filename);
        }

        if ($format === 'xlsx') {
            return $this->spreadsheet->toXlsx($meta, $headers, $rows, $filename);
        }

        return $this->spreadsheet->toCsv($meta, $headers, $rows, $filename);
    }

    /** @return LazyCollection<int, list<string|int|float|null>> */
    private function lazyRows($cursor, callable $mapper): LazyCollection
    {
        return LazyCollection::make(function () use ($cursor, $mapper) {
            foreach ($cursor as $model) {
                yield $mapper($model);
            }
        });
    }
}
