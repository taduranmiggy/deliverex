<?php

namespace App\Services\Reports;

use App\Services\Admin\AuditLogQuery;
use Illuminate\Http\Request;

class ReportExportPreviewService
{
    public function __construct(
        private AuditLogQuery $auditLogQuery,
        private DeliveriesReportQuery $deliveriesQuery,
        private AssignmentAuditReportQuery $assignmentAuditQuery,
        private DriverPerformanceReportQuery $driverPerformanceQuery,
        private OcrReportQuery $ocrReportQuery,
        private EnterpriseReportQuery $enterpriseReportQuery,
    ) {
    }

    /** @return array<string, mixed> */
    public function preview(Request $request, string $report): array
    {
        $maxRows = (int) config('reports.export_max_rows', 10000);

        $result = match ($report) {
            'audit_logs' => $this->previewAuditLogs($request),
            'deliveries' => $this->previewDeliveries($request),
            'driver_performance' => $this->previewDriverPerformance($request),
            'assignment_audit' => $this->previewAssignmentAudit($request),
            'ocr' => $this->previewOcr($request),
            default => $this->previewEnterprise($request, $report),
        };

        $count = (int) ($result['count'] ?? 0);
        $exportCount = min($count, $maxRows);

        return array_merge($result, [
            'report' => $report,
            'count' => $count,
            'export_count' => $exportCount,
            'max_rows' => $maxRows,
            'truncated' => $count > $maxRows,
            'can_export' => $count > 0,
        ]);
    }

    /** @return array<string, mixed> */
    private function previewAuditLogs(Request $request): array
    {
        $range = ExportDateRange::resolve($request);
        $req = ExportDateRange::mergeIntoRequest($request, $range);
        ['query' => $query, 'filters' => $filters] = $this->auditLogQuery->build($req);

        return [
            'count' => $query->count(),
            'date_range' => $range['label'],
            'filters' => array_merge($filters, ['all_records' => $range['all_records'] ? 'yes' : 'no']),
        ];
    }

    /** @return array<string, mixed> */
    private function previewDeliveries(Request $request): array
    {
        $range = ExportDateRange::resolve($request);
        $req = ExportDateRange::mergeIntoRequest($request, $range);
        ['query' => $query, 'filters' => $filters] = $this->deliveriesQuery->build($req);

        return [
            'count' => $query->count(),
            'date_range' => $range['label'],
            'filters' => $filters,
        ];
    }

    /** @return array<string, mixed> */
    private function previewDriverPerformance(Request $request): array
    {
        $range = ExportDateRange::resolve($request);
        $req = ExportDateRange::mergeIntoRequest($request, $range);
        ['rows' => $rows, 'filters' => $filters] = $this->driverPerformanceQuery->build($req);

        return [
            'count' => count($rows),
            'date_range' => $range['label'],
            'filters' => $filters,
        ];
    }

    /** @return array<string, mixed> */
    private function previewAssignmentAudit(Request $request): array
    {
        $range = ExportDateRange::resolve($request);
        $req = ExportDateRange::mergeIntoRequest($request, $range);
        ['query' => $query, 'filters' => $filters] = $this->assignmentAuditQuery->build($req);

        return [
            'count' => $query->count(),
            'date_range' => $range['label'],
            'filters' => $filters,
        ];
    }

    /** @return array<string, mixed> */
    private function previewOcr(Request $request): array
    {
        $range = ExportDateRange::resolve($request, defaultDays: 30);
        $req = ExportDateRange::mergeIntoRequest($request, $range);
        ['query' => $query, 'filters' => $filters] = $this->ocrReportQuery->build($req);

        return [
            'count' => $query->count(),
            'date_range' => $range['label'],
            'filters' => $filters,
        ];
    }

    /** @return array<string, mixed> */
    private function previewEnterprise(Request $request, string $report): array
    {
        $range = ExportDateRange::resolve($request);
        $req = ExportDateRange::mergeIntoRequest($request, $range);
        $data = $this->enterpriseReportQuery->build($req, $report);

        return [
            'count' => count($data['rows']),
            'date_range' => $range['label'],
            'filters' => $data['filters'],
        ];
    }
}
