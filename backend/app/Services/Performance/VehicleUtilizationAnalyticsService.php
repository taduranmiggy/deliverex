<?php

namespace App\Services\Performance;

use App\Models\DispatchAssignment;
use App\Models\Vehicle;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class VehicleUtilizationAnalyticsService
{
    /**
     * @return array{
     *   period: array{from: string, to: string, days: int},
     *   summary: array,
     *   vehicles: Collection,
     *   most_utilized: Collection,
     *   least_utilized: Collection
     * }
     */
    public function analyzeAll(?Carbon $from = null, ?Carbon $to = null, int $rankLimit = 5): array
    {
        $fromDate  = $from ?? now()->subDays(30)->startOfDay();
        $toDate    = $to   ?? now()->endOfDay();
        $periodDays = max(1, (int) $fromDate->copy()->startOfDay()->diffInDays($toDate->copy()->startOfDay()) + 1);

        $vehicles = Vehicle::with('vehicleType')->get();

        $analyzed = $vehicles->map(fn (Vehicle $vehicle) => $this->analyzeVehicle($vehicle, $fromDate, $toDate, $periodDays))
            ->sortByDesc('utilization_pct')
            ->values();

        $withTrips = $analyzed->filter(fn ($row) => $row['total_trips'] > 0)->values();

        return [
            'period' => [
                'from' => $fromDate->toDateString(),
                'to'   => $toDate->toDateString(),
                'days' => $periodDays,
            ],
            'summary' => [
                'total_vehicles'       => $vehicles->count(),
                'total_trips'          => (int) $analyzed->sum('total_trips'),
                'total_delivery_hours' => round($analyzed->sum('total_delivery_hours'), 1),
                'avg_utilization_pct'  => $vehicles->count() > 0
                    ? round($analyzed->avg('utilization_pct'), 1)
                    : 0,
                'active_days_fleet'    => (int) $analyzed->sum('active_days'),
                'idle_days_fleet'      => (int) $analyzed->sum('idle_days'),
            ],
            'vehicles'        => $analyzed,
            'most_utilized'   => $withTrips->take($rankLimit)->values(),
            'least_utilized'  => $analyzed->sortBy('utilization_pct')->take($rankLimit)->values(),
        ];
    }

    public function analyzeVehicle(Vehicle $vehicle, Carbon $fromDate, Carbon $toDate, int $periodDays): array
    {
        $assignments = DispatchAssignment::where('vehicle_id', $vehicle->id)
            ->whereNotIn('status', ['cancelled'])
            ->where(function ($q) use ($fromDate, $toDate) {
                $q->whereBetween('assigned_at', [$fromDate, $toDate])
                    ->orWhereBetween('completed_at', [$fromDate, $toDate])
                    ->orWhere(function ($inner) use ($fromDate, $toDate) {
                        $inner->where('assigned_at', '<=', $toDate)
                            ->where(function ($w) use ($fromDate) {
                                $w->whereNull('completed_at')
                                    ->orWhere('completed_at', '>=', $fromDate);
                            });
                    });
            })
            ->get();

        $activeDaysSet = [];
        $totalHours    = 0.0;

        foreach ($assignments as $assignment) {
            $start = $assignment->started_at
                ?? $assignment->assigned_at
                ?? $assignment->created_at;

            if (! $start) {
                continue;
            }

            $end = $assignment->completed_at;
            if (! $end && ! in_array($assignment->status, ['completed', 'cancelled'], true)) {
                $end = now()->lessThan($toDate) ? now() : $toDate->copy();
            }
            $end = $end ?? $assignment->updated_at ?? $start;

            $start = $start->copy()->max($fromDate);
            $end   = $end->copy()->min($toDate);

            if ($end->lessThan($start)) {
                continue;
            }

            $totalHours += $start->diffInMinutes($end) / 60;

            $cursor = $start->copy()->startOfDay();
            $lastDay = $end->copy()->startOfDay();
            while ($cursor->lessThanOrEqualTo($lastDay)) {
                $activeDaysSet[$cursor->toDateString()] = true;
                $cursor->addDay();
            }
        }

        $activeDays     = count($activeDaysSet);
        $idleDays       = max(0, $periodDays - $activeDays);
        $utilizationPct = round(($activeDays / $periodDays) * 100, 1);

        return [
            'id'                   => $vehicle->id,
            'plate_no'             => $vehicle->plate_no,
            'type'                 => $vehicle->type ?? $vehicle->vehicleType?->name ?? '—',
            'total_trips'          => $assignments->count(),
            'total_delivery_hours' => round($totalHours, 1),
            'active_days'          => $activeDays,
            'idle_days'            => $idleDays,
            'utilization_pct'      => $utilizationPct,
        ];
    }
}
