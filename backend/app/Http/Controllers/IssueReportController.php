<?php

namespace App\Http\Controllers;

use App\Models\DeliveryIssueReport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class IssueReportController extends Controller
{
    public function index(Request $request)
    {
        $query = DeliveryIssueReport::with([
            'assignment.jobOrder',
            'assignment.driver.user',
            'driver.user',
            'reporter',
        ])->latest();

        if ($request->filled('assignment_id')) {
            $query->where('assignment_id', $request->integer('assignment_id'));
        }

        if ($request->boolean('recent')) {
            $query->where('created_at', '>=', now()->subDays(30));
        }

        $paginated = $query->paginate(20);

        $paginated->getCollection()->transform(fn (DeliveryIssueReport $report) => $this->formatReport($report));

        return response()->json($paginated);
    }

    private function formatReport(DeliveryIssueReport $report): array
    {
        $job = $report->assignment?->jobOrder;

        return [
            'id'              => $report->id,
            'assignment_id'   => $report->assignment_id,
            'job_order_id'    => $job?->id,
            'issue_type'      => $report->issue_type,
            'issue_type_label'=> DeliveryIssueReport::typeLabel($report->issue_type),
            'notes'           => $report->notes,
            'photo_url'       => $report->photo_path
                ? Storage::disk('public')->url($report->photo_path)
                : null,
            'driver_name'     => $report->driver?->user?->name ?? $report->assignment?->driver?->user?->name,
            'reporter_name'   => $report->reporter?->name,
            'customer_name'   => $job?->display_name ?? $job?->customer_name,
            'tracking_code'   => $job?->tracking_code,
            'created_at'      => $report->created_at?->toIso8601String(),
        ];
    }
}
