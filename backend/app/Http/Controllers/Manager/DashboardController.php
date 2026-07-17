<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Performance\ManagerDashboardMetricsService;
use App\Support\DeliveryStatus;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct(
        private readonly ManagerDashboardMetricsService $metricsService,
    ) {}

    public function index()
    {
        $delayed = JobOrder::whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('scheduled_end')
            ->where('scheduled_end', '<', now())
            ->count();

        // Daily completed for the last 7 days
        $dailyCompleted = DispatchAssignment::where('status', 'completed')
            ->where('completed_at', '>=', now()->subDays(6)->startOfDay())
            ->select(DB::raw('DATE(completed_at) as date'), DB::raw('COUNT(*) as count'))
            ->groupBy(DB::raw('DATE(completed_at)'))
            ->orderBy('date')
            ->get()
            ->mapWithKeys(fn ($row) => [\Illuminate\Support\Carbon::parse($row->date)->toDateString() => (int) $row->count]);

        $weekDays = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now()->subDays($i);
            $d = $day->toDateString();
            $weekDays[] = [
                'label' => $day->format('D'),
                'date'  => $d,
                'count' => (int) ($dailyCompleted[$d] ?? 0),
            ];
        }

        $kpis = $this->metricsService->compute();

        return response()->json([
            'job_orders'          => JobOrder::count(),
            'jobs_completed'      => JobOrder::where('status', 'completed')->count(),
            'jobs_pending'        => JobOrder::where('status', 'pending')->count(),
            'assignments_active'  => DispatchAssignment::whereIn('status', [
                DeliveryStatus::ASSIGNED,
                DeliveryStatus::EN_ROUTE_TO_PICKUP,
                DeliveryStatus::ARRIVED_AT_PICKUP,
                DeliveryStatus::EN_ROUTE_TO_DESTINATION,
                DeliveryStatus::ARRIVED,
            ])->count(),
            'drivers_available'   => Driver::where('availability', 'available')->count(),
            'vehicles_available'  => Vehicle::where('status', 'available')->count(),
            'delayed_today'       => $delayed,
            'completed_this_week' => (int) collect($weekDays)->sum('count'),
            'daily_completed'     => $weekDays,
            ...$kpis,
        ]);
    }
}
