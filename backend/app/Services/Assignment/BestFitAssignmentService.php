<?php

namespace App\Services\Assignment;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Support\AssignmentScheduleConflict;
use App\Support\VehicleCapacity;

class BestFitAssignmentService
{
    /**
     * Rank driver × vehicle pairs for a job using a best-fit score (higher is better).
     */
    public function recommend(JobOrder $jobOrder): array
    {
        $drivers = Driver::query()
            ->with('user')
            ->where('availability', '!=', 'offline')
            ->get()
            ->filter(fn (Driver $d) => ! AssignmentScheduleConflict::hasDriverConflict($d->id, $jobOrder));

        $vehicles = Vehicle::query()
            ->whereNotIn('status', ['maintenance', 'unavailable'])
            ->get()
            ->filter(fn (Vehicle $v) => ! AssignmentScheduleConflict::hasVehicleConflict($v->id, $jobOrder));

        $requiredWeight = $jobOrder->weight_kg !== null ? (float) $jobOrder->weight_kg : null;
        $requiredVolume = $jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null;

        $recommendations = [];

        foreach ($drivers as $driver) {
            foreach ($vehicles as $vehicle) {
                if (! $this->isFeasible($vehicle, $requiredWeight, $requiredVolume)) {
                    continue;
                }

                ['score' => $score, 'reasons' => $reasons] = $this->scorePair($jobOrder, $driver, $vehicle);

                $recommendations[] = [
                    'driver_id'        => $driver->id,
                    'driver_name'      => $driver->user?->name,
                    'vehicle_id'       => $vehicle->id,
                    'vehicle_plate'    => $vehicle->plate_no,
                    'vehicle_type'     => $vehicle->type,
                    'vehicle_capacity' => $vehicle->capacity,
                    'score'            => $score,
                    'reasons'          => $reasons,
                    'feasible'         => true,
                ];
            }
        }

        usort($recommendations, fn ($a, $b) => $b['score'] <=> $a['score']);

        return array_slice($recommendations, 0, 10);
    }

    private function isFeasible(Vehicle $vehicle, ?float $requiredWeightKg, ?float $requiredVolumeM3): bool
    {
        $maxWeight = $vehicle->max_weight_kg !== null
            ? (float) $vehicle->max_weight_kg
            : VehicleCapacity::labelToKg($vehicle->capacity);

        if ($requiredWeightKg !== null && $maxWeight !== null && $requiredWeightKg > $maxWeight) {
            return false;
        }

        $maxVol = $vehicle->max_volume_m3 !== null ? (float) $vehicle->max_volume_m3 : null;
        if ($requiredVolumeM3 !== null && $maxVol !== null && $requiredVolumeM3 > $maxVol) {
            return false;
        }

        return true;
    }

    private function scorePair(JobOrder $jobOrder, Driver $driver, Vehicle $vehicle): array
    {
        $score   = 30.0;
        $reasons = [];

        // --- Vehicle scoring ---
        if ($jobOrder->vehicle_type_required && strcasecmp((string) $vehicle->type, (string) $jobOrder->vehicle_type_required) === 0) {
            $score += 30;
            $reasons[] = 'Vehicle type is an exact match ('.$vehicle->type.')';
        } elseif ($jobOrder->vehicle_type_required && str_contains(
            strtolower((string) $vehicle->type),
            strtolower((string) $jobOrder->vehicle_type_required)
        )) {
            $score += 18;
            $reasons[] = 'Vehicle type is a partial match ('.$vehicle->type.')';
        }

        $reqCapacityLabel = (string) ($jobOrder->vehicle_capacity_required ?? '');
        $vehCapacityLabel = (string) ($vehicle->capacity ?? '');
        if ($reqCapacityLabel !== '' && $vehCapacityLabel !== '' && strcasecmp($reqCapacityLabel, $vehCapacityLabel) === 0) {
            $score += 12;
            $reasons[] = "Capacity label matches requirement ({$vehCapacityLabel})";
        }

        $maxWeight = $vehicle->max_weight_kg !== null
            ? (float) $vehicle->max_weight_kg
            : VehicleCapacity::labelToKg($vehicle->capacity);
        $jobWeight = $jobOrder->weight_kg !== null ? (float) $jobOrder->weight_kg : null;
        if ($maxWeight !== null && $jobWeight !== null && $jobWeight > 0) {
            $utilization = $jobWeight / $maxWeight;
            if ($utilization <= 1) {
                $score += 10 * (1 - abs(0.82 - $utilization));
                $reasons[] = 'Payload utilization at '.round($utilization * 100).'% of vehicle capacity';
            }
        }

        if ($vehicle->status === 'available') {
            $score += 8;
            $reasons[] = 'Vehicle is currently available';
        } elseif ($vehicle->status === 'assigned') {
            $score += 4;
            $reasons[] = 'Vehicle assigned elsewhere but schedule does not conflict';
        }

        // --- Driver scoring ---
        $activeCount = DispatchAssignment::where('driver_id', $driver->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        if ($driver->availability === 'available') {
            $score += 12;
            $reasons[] = 'Driver is marked available';
        } elseif ($driver->availability === 'busy' && $activeCount > 0) {
            $score += 5;
            $reasons[] = 'Driver has active work but is free for this schedule window';
        }

        if ($activeCount === 0) {
            $score += 10;
            $reasons[] = 'No other active assignments';
        } elseif ($activeCount === 1) {
            $score += 4;
        } else {
            $score -= min(8, ($activeCount - 1) * 3);
            $reasons[] = "Driver workload: {$activeCount} active assignments";
        }

        // Delivery type alignment (optional field)
        if ($jobOrder->delivery_type && $vehicle->type) {
            if (stripos((string) $vehicle->type, (string) $jobOrder->delivery_type) !== false) {
                $score += 6;
                $reasons[] = 'Vehicle type aligns with delivery type ('.$jobOrder->delivery_type.')';
            }
        }

        // Priority urgency
        $priorityBonus = match ($jobOrder->priority) {
            'urgent' => 15,
            'high'   => 10,
            'low'    => 3,
            default  => 6,
        };
        $score += $priorityBonus;
        if ($jobOrder->priority === 'urgent') {
            $reasons[] = 'Urgent priority — elevated scheduling weight';
        }

        if ($jobOrder->scheduled_start) {
            $hours = $jobOrder->scheduled_start->diffInHours(now(), false);
            if ($hours > 0 && $hours < 72) {
                $score += max(0, 12 - ($hours / 6));
                $reasons[] = 'Job scheduled within '.round($hours).' hours';
            }
        }

        if (empty($reasons)) {
            $reasons[] = 'Meets capacity and schedule requirements';
        }

        return ['score' => round(max(0, $score), 2), 'reasons' => $reasons];
    }
}
