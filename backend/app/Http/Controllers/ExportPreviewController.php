<?php

namespace App\Http\Controllers;

use App\Services\Reports\ReportExportPreviewService;
use Illuminate\Http\Request;

class ExportPreviewController extends Controller
{
    public function __construct(private readonly ReportExportPreviewService $previewService)
    {
    }

    public function show(Request $request)
    {
        $report = (string) $request->query('report', '');
        $this->authorizeReport($request, $report);

        return response()->json($this->previewService->preview($request, $report));
    }

    private function authorizeReport(Request $request, string $report): void
    {
        $user = $request->user();
        $role = $user?->role?->name;

        $allowed = match ($report) {
            'audit_logs', 'ocr', 'email_monitoring', 'system_logs' => $role === 'admin',
            'deliveries', 'driver_performance', 'assignment_audit' => $role === 'manager',
            'job_orders', 'tracking', 'ocr_reviews', 'notifications', 'analytics',
            'drivers', 'vehicles', 'customers', 'support_inquiries', 'chatbox' => in_array($role, ['admin', 'manager'], true),
            default => false,
        };

        if (! $allowed) {
            abort(403, 'You are not allowed to preview this report.');
        }
    }
}
