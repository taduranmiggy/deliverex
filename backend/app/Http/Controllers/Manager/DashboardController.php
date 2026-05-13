<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $delayed = JobOrder::whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('scheduled_end')
            ->where('scheduled_end', '<', now())
            ->count();

        // Daily completed for the last 7 days
        $dailyCompleted = DispatchAssignment::where('status', 'completed')
            ->where('completed_at', '>=', now()->subDays(6)->startOfDay())
            ->select(DB::raw("DATE(completed_at) as date"), DB::raw("COUNT(*) as count"))
            ->groupBy(DB::raw("DATE(completed_at)"))
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $weekDays = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = now()->subDays($i)->toDateString();
            $weekDays[] = [
                'label' => now()->subDays($i)->format('D'),
                'date'  => $d,
                'count' => (int) ($dailyCompleted[$d]->count ?? 0),
            ];
        }

        // On-time rate (completed before or on scheduled_end, this month)
        $completedThisMonth = DispatchAssignment::where('status', 'completed')
            ->where('completed_at', '>=', now()->startOfMonth())
            ->count();

        $onTimeThisMonth = DispatchAssignment::where('status', 'completed')
            ->where('completed_at', '>=', now()->startOfMonth())
            ->whereHas('jobOrder', fn ($q) => $q->whereNotNull('scheduled_end'))
            ->whereRaw('dispatch_assignments.completed_at <= (SELECT scheduled_end FROM job_orders WHERE job_orders.id = dispatch_assignments.job_order_id)')
            ->count();

        $onTimePct = $completedThisMonth > 0
            ? round(($onTimeThisMonth / $completedThisMonth) * 100, 1)
            : null;

        return response()->json([
            'job_orders'          => JobOrder::count(),
            'jobs_completed'      => JobOrder::where('status', 'completed')->count(),
            'jobs_pending'        => JobOrder::where('status', 'pending')->count(),
            'assignments_active'  => DispatchAssignment::whereIn('status', ['assigned', 'in_progress', 'arrived'])->count(),
            'drivers_available'   => Driver::where('availability', 'available')->count(),
            'vehicles_available'  => Vehicle::where('status', 'available')->count(),
            'delayed_today'       => $delayed,
            'completed_this_week' => (int) collect($weekDays)->sum('count'),
            'on_time_pct'         => $onTimePct,
            'daily_completed'     => $weekDays,
        ]);
    }
}
