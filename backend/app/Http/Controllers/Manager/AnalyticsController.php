<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DeliveryDelayReport;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $from   = $request->query('from');
        $to     = $request->query('to');
        $status = $request->query('status');

        $fromDate = $from ? Carbon::parse($from)->startOfDay() : now()->subDays(30)->startOfDay();
        $toDate   = $to   ? Carbon::parse($to)->endOfDay()     : now()->endOfDay();

        // --- Job order summary ---
        $baseJobs = JobOrder::whereBetween('created_at', [$fromDate, $toDate]);
        if ($status) {
            $baseJobs->where('status', $status);
        }

        $totalJobs     = (clone $baseJobs)->count();
        $completed     = (clone $baseJobs)->where('status', 'completed')->count();
        $pending       = (clone $baseJobs)->where('status', 'pending')->count();
        $inProgress    = (clone $baseJobs)->whereIn('status', ['assigned', 'in_progress', 'arrived'])->count();
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

        // --- Driver performance ---
        $drivers = Driver::with('user')->get();
        $driverStats = $drivers->map(function (Driver $driver) use ($fromDate, $toDate) {
            $base = DispatchAssignment::where('driver_id', $driver->id)
                ->whereBetween('created_at', [$fromDate, $toDate]);

            $total     = (clone $base)->count();
            $completed = (clone $base)->where('status', 'completed')->count();

            // On-time: completed before or on scheduled_end
            $onTime = (clone $base)
                ->where('status', 'completed')
                ->whereHas('jobOrder', fn ($q) => $q->whereNotNull('scheduled_end'))
                ->whereRaw('dispatch_assignments.completed_at <= (SELECT scheduled_end FROM job_orders WHERE job_orders.id = dispatch_assignments.job_order_id)')
                ->count();

            $onTimePct = $completed > 0 ? round(($onTime / $completed) * 100, 1) : null;

            return [
                'id'          => $driver->id,
                'name'        => $driver->user?->name ?? '—',
                'total'       => $total,
                'completed'   => $completed,
                'on_time'     => $onTime,
                'on_time_pct' => $onTimePct,
                'availability'=> $driver->availability,
            ];
        })->sortByDesc('completed')->values();

        // --- Daily completed (last 14 days within range) ---
        $dailyStats = DispatchAssignment::where('status', 'completed')
            ->whereBetween('completed_at', [$fromDate, $toDate])
            ->select(DB::raw('DATE(completed_at) as date'), DB::raw('COUNT(*) as count'))
            ->groupBy(DB::raw('DATE(completed_at)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => ['date' => $row->date, 'count' => (int) $row->count]);

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
                'total'       => $totalJobs,
                'completed'   => $completed,
                'in_progress' => $inProgress,
                'pending'     => $pending,
                'cancelled'   => $cancelled,
                'delayed'     => $delayed,
            ],
            'fleet' => [
                'total'           => $totalVehicles,
                'available'       => $availableVehicles,
                'assigned'        => $assignedVehicles,
                'maintenance'     => $maintenanceVehicles,
                'utilization_pct' => $utilizationPct,
            ],
            'drivers'      => $driverStats,
            'daily_stats'  => $dailyStats,
            'delays'       => [
                'total_reports'        => (clone $delayBase)->count(),
                'common_reasons'       => $commonDelayReasons,
                'monthly_trends'       => $monthlyDelayTrends,
                'driver_delay_rates'   => $driverDelayRates,
                'vehicle_delay_rates'  => $vehicleDelayRates,
            ],
            'filters'      => [
                'from'   => $fromDate->toDateString(),
                'to'     => $toDate->toDateString(),
                'status' => $status,
            ],
        ]);
    }
}
