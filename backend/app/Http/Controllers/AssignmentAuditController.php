<?php

namespace App\Http\Controllers;

use App\Models\AssignmentAuditTrail;
use Illuminate\Http\Request;

class AssignmentAuditController extends Controller
{
    public function index(Request $request)
    {
        $query = AssignmentAuditTrail::with([
            'jobOrder',
            'dispatcher',
            'assignment',
        ])->latest();

        if ($request->boolean('recent')) {
            $query->where('created_at', '>=', now()->subDays(30));
        }

        if ($request->boolean('overrides_only')) {
            $query->where('is_override', true);
        }

        if ($request->filled('job_order_id')) {
            $query->where('job_order_id', $request->integer('job_order_id'));
        }

        $paginated = $query->paginate($request->integer('per_page', 20));

        $paginated->getCollection()->transform(fn (AssignmentAuditTrail $trail) => $this->formatTrail($trail));

        return response()->json($paginated);
    }

    private function formatTrail(AssignmentAuditTrail $trail): array
    {
        return [
            'id'                        => $trail->id,
            'assignment_id'             => $trail->assignment_id,
            'job_order_id'              => $trail->job_order_id,
            'dispatcher_name'           => $trail->dispatcher?->name,
            'recommended_driver_name'   => $trail->recommended_driver_name,
            'recommended_vehicle_plate' => $trail->recommended_vehicle_plate,
            'assigned_driver_name'      => $trail->assigned_driver_name,
            'assigned_vehicle_plate'    => $trail->assigned_vehicle_plate,
            'is_override'                 => $trail->is_override,
            'override_reason'           => $trail->override_reason,
            'best_fit_score'            => $trail->best_fit_score,
            'best_fit_reasons'          => $trail->best_fit_reasons ?? [],
            'customer_name'             => $trail->jobOrder?->display_name ?? $trail->jobOrder?->customer_name,
            'tracking_code'             => $trail->jobOrder?->tracking_code,
            'created_at'                => $trail->created_at?->toIso8601String(),
        ];
    }
}
