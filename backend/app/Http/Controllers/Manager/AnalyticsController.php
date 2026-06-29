<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DeliveryDelayReport;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Performance\DriverPerformanceScoringService;
use App\Support\DeliveryStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function __construct(private DriverPerformanceScoringService $scoringService)
    {
    }

    public function index(Request $request)
    {
        $from   = $request->query('from');
        $to     = $request->query('to');
        $status = $request->query('status');

        $fromDate = $from ? Carbon::parse($from)->startOfDay() : now()->subDays(30)->startOfDay();
        $toDate   = $to   ? Carbon::parse($to)->endOfDay()     : now()->endOfDay();

        $driversPage = max(1, (int) $request->query('drivers_page', 1));
        $driversPerPage = min(50, max(5, (int) $request->query('drivers_per_page', 10)));

        // --- Job order summary ---
        $baseJobs = JobOrder::whereBetween('created_at', [$fromDate, $toDate]);
        if ($status) {
            $baseJobs->where('status', $status);
        }

        $totalJobs     = (clone $baseJobs)->count();
        $completed     = (clone $baseJobs)->where('status', 'completed')->count();
        $pending       = (clone $baseJobs)->where('status', 'pending')->count();
        $inProgress    = (clone $baseJobs)->whereIn('status', [
            DeliveryStatus::ASSIGNED,
            'in_progress',
            DeliveryStatus::EN_ROUTE_TO_PICKUP,
            DeliveryStatus::ARRIVED_AT_PICKUP,
            DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            DeliveryStatus::ARRIVED,
        ])->count();
        $cancelled     = (clone $baseJobs)->where('status', 'cancelled')->count();

        // Delayed: active jobs that are past their scheduled_end
        $delayed = JobOrder::whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('scheduled_end')
            ->where('scheduled_end', '<', now())
            ->count();

        // --- Fleet utilization ---
        $totalVehicles     = Vehicle::count();
        $availableVehicles = Vehicle::where('status', 'available')->count();
        $assignedVehicles  = Vehicle::where('status', 'assigned')->count();
        $maintenanceVehicles = Vehicle::where('status', 'maintenance')->count();
        $utilizationPct    = $totalVehicles > 0
            ? round(($assignedVehicles / $totalVehicles) * 100, 1)
            : 0;

        // --- Driver performance (scored + paginated) ---
        $availabilityById = Driver::pluck('availability', 'id');
        $scored = $this->scoringService->scoreAll($fromDate, $toDate, 5);

        $driverStats = $scored['drivers']->map(function (array $row) use ($availabilityById) {
            $completedCount = (int) ($row['breakdown']['completed_deliveries'] ?? 0);
            $totalAssignments = (int) ($row['total_assignments'] ?? 0);

            return [
                'id'                 => $row['id'],
                'name'               => $row['name'],
                'reliability_score'  => $row['reliability_score'],
                'total'              => $totalAssignments,
                'completed'          => $completedCount,
                'completion_pct'     => $totalAssignments > 0
                    ? round(($completedCount / $totalAssignments) * 100, 1)
                    : null,
                'on_time_pct'        => $row['breakdown']['on_time_pct'] ?? null,
                'delay_rate_pct'     => $row['breakdown']['delay_rate_pct'] ?? null,
                'ocr_accuracy_pct'   => $row['breakdown']['ocr_accuracy_pct'] ?? null,
                'issue_reports'      => $row['breakdown']['issue_reports'] ?? 0,
                'availability'       => $availabilityById[$row['id']] ?? 'unknown',
            ];
        })->sortByDesc('reliability_score')->values();

        $driversTotal = $driverStats->count();
        $driversLastPage = max(1, (int) ceil($driversTotal / $driversPerPage));
        $driversPage = min($driversPage, $driversLastPage);

        $paginatedDrivers = $driverStats
            ->slice(($driversPage - 1) * $driversPerPage, $driversPerPage)
            ->values();

        // --- Daily completed deliveries (filled date series) ---
        $dailyRaw = DispatchAssignment::where('status', 'completed')
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->select(DB::raw('DATE(completed_at) as date'), DB::raw('COUNT(*) as count'))
            ->groupBy(DB::raw('DATE(completed_at)'))
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $dailyStats = $this->buildDailySeries($fromDate, $toDate, $dailyRaw);

        // --- Delay reason analytics ---
        $delayBase = DeliveryDelayReport::whereBetween('created_at', [$fromDate, $toDate]);

        $commonDelayReasons = (clone $delayBase)
            ->select('delay_reason', DB::raw('COUNT(*) as count'))
            ->groupBy('delay_reason')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => [
                'reason' => $row->delay_reason,
                'label'  => DeliveryDelayReport::REASONS[$row->delay_reason] ?? $row->delay_reason,
                'count'  => (int) $row->count,
            ]);

        $monthlyDelayTrends = (clone $delayBase)
            ->select(DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"), DB::raw('COUNT(*) as count'))
            ->groupBy(DB::raw("DATE_FORMAT(created_at, '%Y-%m')"))
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => ['month' => $row->month, 'count' => (int) $row->count]);

        $drivers = Driver::with('user')->get();
        $driverDelayRates = $drivers->map(function (Driver $driver) use ($fromDate, $toDate) {
            $totalAssignments = DispatchAssignment::where('driver_id', $driver->id)
                ->whereBetween('created_at', [$fromDate, $toDate])
                ->count();
            $delayCount = DeliveryDelayReport::where('driver_id', $driver->id)
                ->whereBetween('created_at', [$fromDate, $toDate])
                ->count();
            $rate = $totalAssignments > 0
                ? round(($delayCount / $totalAssignments) * 100, 1)
                : null;

            return [
                'id'                => $driver->id,
                'name'              => $driver->user?->name ?? '—',
                'total_assignments' => $totalAssignments,
                'delay_reports'     => $delayCount,
                'delay_rate_pct'    => $rate,
            ];
        })->filter(fn ($row) => $row['total_assignments'] > 0)
            ->sortByDesc('delay_rate_pct')
            ->values();

        $vehicles = Vehicle::with('vehicleType')->get();
        $vehicleDelayRates = $vehicles->map(function (Vehicle $vehicle) use ($fromDate, $toDate) {
            $totalAssignments = DispatchAssignment::where('vehicle_id', $vehicle->id)
                ->whereBetween('created_at', [$fromDate, $toDate])
                ->count();
            $delayCount = DeliveryDelayReport::whereHas(
                'assignment',
                fn ($q) => $q->where('vehicle_id', $vehicle->id)
            )->whereBetween('created_at', [$fromDate, $toDate])->count();
            $rate = $totalAssignments > 0
                ? round(($delayCount / $totalAssignments) * 100, 1)
                : null;

            return [
                'id'                => $vehicle->id,
                'plate_no'          => $vehicle->plate_no,
                'type'              => $vehicle->type ?? $vehicle->vehicleType?->name,
                'total_assignments' => $totalAssignments,
                'delay_reports'     => $delayCount,
                'delay_rate_pct'    => $rate,
            ];
        })->filter(fn ($row) => $row['total_assignments'] > 0)
            ->sortByDesc('delay_rate_pct')
            ->values();

        return response()->json([
            'summary' => [
                'total'              => $totalJobs,
                'completed'          => $completed,
                'in_progress'        => $inProgress,
                'pending'            => $pending,
                'cancelled'          => $cancelled,
                'delayed'            => $delayed,
                'completion_rate_pct'=> $totalJobs > 0 ? round(($completed / $totalJobs) * 100, 1) : null,
            ],
            'fleet' => [
                'total'           => $totalVehicles,
                'available'       => $availableVehicles,
                'assigned'        => $assignedVehicles,
                'maintenance'     => $maintenanceVehicles,
                'utilization_pct' => $utilizationPct,
            ],
            'drivers'             => $paginatedDrivers,
            'drivers_pagination'  => [
                'current_page' => $driversPage,
                'per_page'     => $driversPerPage,
                'total'        => $driversTotal,
                'last_page'    => $driversLastPage,
            ],
            'driver_performance'  => [
                'period'            => $scored['period'],
                'top_performers'    => $scored['top_performers'],
                'lowest_performers' => $scored['lowest_performers'],
            ],
            'daily_stats'         => $dailyStats,
            'charts'              => [
                'job_status' => [
                    ['name' => 'Completed', 'value' => $completed],
                    ['name' => 'In Progress', 'value' => $inProgress],
                    ['name' => 'Pending', 'value' => $pending],
                    ['name' => 'Cancelled', 'value' => $cancelled],
                    ['name' => 'Delayed', 'value' => $delayed],
                ],
            ],
            'delays'              => [
                'total_reports'       => (clone $delayBase)->count(),
                'common_reasons'      => $commonDelayReasons,
                'monthly_trends'      => $monthlyDelayTrends,
                'driver_delay_rates'  => $driverDelayRates,
                'vehicle_delay_rates' => $vehicleDelayRates,
            ],
            'filters'             => [
                'from'   => $fromDate->toDateString(),
                'to'     => $toDate->toDateString(),
                'status' => $status,
            ],
        ]);
    }

    /**
     * @param  \Illuminate\Support\Collection<string, object>  $dailyRaw
     * @return list<array{date: string, label: string, count: int}>
     */
    private function buildDailySeries(Carbon $fromDate, Carbon $toDate, $dailyRaw): array
    {
        $series = [];
        $cursor = $fromDate->copy()->startOfDay();
        $end = $toDate->copy()->startOfDay();

        while ($cursor->lte($end)) {
            $dateKey = $cursor->toDateString();
            $series[] = [
                'date'  => $dateKey,
                'label' => $cursor->format('M j'),
                'count' => (int) ($dailyRaw->get($dateKey)?->count ?? 0),
            ];
            $cursor->addDay();
        }

        return $series;
    }
}
