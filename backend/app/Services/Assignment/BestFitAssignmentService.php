<?php

namespace App\Services\Assignment;

use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Support\VehicleCapacity;

class BestFitAssignmentService
{
    /**
     * Rank driver × vehicle pairs for a job using a best-fit score (higher is better).
     * Feasibility filters drop pairs that cannot satisfy declared weight / volume.
     */
    public function recommend(JobOrder $jobOrder): array
    {
        $drivers = Driver::query()->with('user')->where('availability', 'available')->get();
        $vehicles = Vehicle::query()->where('status', 'available')->get();

        $requiredWeight = $jobOrder->weight_kg !== null ? (float) $jobOrder->weight_kg : null;
        $requiredVolume = $jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null;

        $recommendations = [];

        foreach ($drivers as $driver) {
            foreach ($vehicles as $vehicle) {
                if (! $this->isFeasible($vehicle, $requiredWeight, $requiredVolume)) {
                    continue;
                }

                $recommendations[] = [
                    'driver_id' => $driver->id,
                    'driver_name' => $driver->user?->name,
                    'vehicle_id' => $vehicle->id,
                    'vehicle_plate' => $vehicle->plate_no,
                    'vehicle_type' => $vehicle->type,
                    'score' => $this->scorePair($jobOrder, $vehicle),
                    'feasible' => true,
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

    private function scorePair(JobOrder $jobOrder, Vehicle $vehicle): float
    {
        $score = 40.0; // baseline for passing feasibility

        if ($jobOrder->vehicle_type_required && strcasecmp((string) $vehicle->type, (string) $jobOrder->vehicle_type_required) === 0) {
            $score += 35;
        } elseif ($jobOrder->vehicle_type_required && str_contains(
            strtolower((string) $vehicle->type),
            strtolower((string) $jobOrder->vehicle_type_required)
        )) {
            $score += 22;
        }

        $reqCapacityLabel = (string) ($jobOrder->vehicle_capacity_required ?? '');
        $vehCapacityLabel = (string) ($vehicle->capacity ?? '');
        if ($reqCapacityLabel !== '' && $vehCapacityLabel !== '' && strcasecmp($reqCapacityLabel, $vehCapacityLabel) === 0) {
            $score += 15;
        }

        $maxWeight = $vehicle->max_weight_kg !== null
            ? (float) $vehicle->max_weight_kg
            : VehicleCapacity::labelToKg($vehicle->capacity);
        $jobWeight = $jobOrder->weight_kg !== null ? (float) $jobOrder->weight_kg : null;
        if ($maxWeight !== null && $jobWeight !== null && $jobWeight > 0) {
            $utilization = $jobWeight / $maxWeight;
            if ($utilization <= 1) {
                // Prefer tight fits (high utilization) without going infeasible.
                $score += 10 * (1 - abs(0.82 - $utilization));
            }
        }

        $score += match ($jobOrder->priority) {
            'urgent' => 18,
            'high' => 12,
            'low' => 4,
            default => 8,
        };

        if ($jobOrder->scheduled_start) {
            $hours = $jobOrder->scheduled_start->diffInHours(now(), false);
            // Prefer jobs that are due sooner (positive hours = future).
            if ($hours > 0 && $hours < 72) {
                $score += max(0, 14 - ($hours / 6));
            }
        }

        return round($score, 2);
    }
}
