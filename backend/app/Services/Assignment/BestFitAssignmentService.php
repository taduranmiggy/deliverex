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
     */
    public function recommend(JobOrder $jobOrder): array
    {
        $drivers  = Driver::query()->with('user')->where('availability', 'available')->get();
        $vehicles = Vehicle::query()->where('status', 'available')->get();

        $requiredWeight = $jobOrder->weight_kg !== null ? (float) $jobOrder->weight_kg : null;
        $requiredVolume = $jobOrder->volume_m3  !== null ? (float) $jobOrder->volume_m3  : null;

        $recommendations = [];

        foreach ($drivers as $driver) {
            foreach ($vehicles as $vehicle) {
                if (! $this->isFeasible($vehicle, $requiredWeight, $requiredVolume)) {
                    continue;
                }

                ['score' => $score, 'reasons' => $reasons] = $this->scorePair($jobOrder, $vehicle);

                $recommendations[] = [
                    'driver_id'     => $driver->id,
                    'driver_name'   => $driver->user?->name,
                    'vehicle_id'    => $vehicle->id,
                    'vehicle_plate' => $vehicle->plate_no,
                    'vehicle_type'  => $vehicle->type,
                    'vehicle_capacity' => $vehicle->capacity,
                    'score'         => $score,
                    'reasons'       => $reasons,
                    'feasible'      => true,
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

    private function scorePair(JobOrder $jobOrder, Vehicle $vehicle): array
    {
        $score   = 40.0;
        $reasons = [];

        // Vehicle type match
        if ($jobOrder->vehicle_type_required && strcasecmp((string) $vehicle->type, (string) $jobOrder->vehicle_type_required) === 0) {
            $score += 35;
            $reasons[] = 'Vehicle type is an exact match (' . $vehicle->type . ')';
        } elseif ($jobOrder->vehicle_type_required && str_contains(
            strtolower((string) $vehicle->type),
            strtolower((string) $jobOrder->vehicle_type_required)
        )) {
            $score += 22;
            $reasons[] = 'Vehicle type is a partial match (' . $vehicle->type . ')';
        }

        // Capacity label match
        $reqCapacityLabel = (string) ($jobOrder->vehicle_capacity_required ?? '');
        $vehCapacityLabel = (string) ($vehicle->capacity ?? '');
        if ($reqCapacityLabel !== '' && $vehCapacityLabel !== '' && strcasecmp($reqCapacityLabel, $vehCapacityLabel) === 0) {
            $score += 15;
            $reasons[] = "Capacity label matches requirement ({$vehCapacityLabel})";
        }

        // Weight utilization — prefer tight fits
        $maxWeight = $vehicle->max_weight_kg !== null
            ? (float) $vehicle->max_weight_kg
            : VehicleCapacity::labelToKg($vehicle->capacity);
        $jobWeight = $jobOrder->weight_kg !== null ? (float) $jobOrder->weight_kg : null;
        if ($maxWeight !== null && $jobWeight !== null && $jobWeight > 0) {
            $utilization = $jobWeight / $maxWeight;
            if ($utilization <= 1) {
                $utilizationBonus = 10 * (1 - abs(0.82 - $utilization));
                $score += $utilizationBonus;
                $pct = round($utilization * 100);
                $reasons[] = "Payload utilization at {$pct}% of vehicle capacity";
            }
        }

        // Priority urgency
        $priorityBonus = match ($jobOrder->priority) {
            'urgent' => 18,
            'high'   => 12,
            'low'    => 4,
            default  => 8,
        };
        $score += $priorityBonus;
        if ($jobOrder->priority === 'urgent') {
            $reasons[] = 'Urgent priority — high scheduling weight applied';
        } elseif ($jobOrder->priority === 'high') {
            $reasons[] = 'High priority — elevated scheduling weight applied';
        }

        // Schedule urgency
        if ($jobOrder->scheduled_start) {
            $hours = $jobOrder->scheduled_start->diffInHours(now(), false);
            if ($hours > 0 && $hours < 72) {
                $schedBonus = max(0, 14 - ($hours / 6));
                $score += $schedBonus;
                $reasons[] = 'Job is scheduled within ' . round($hours) . ' hours';
            }
        }

        if (empty($reasons)) {
            $reasons[] = 'Vehicle meets all capacity requirements for this job';
        }

        return ['score' => round($score, 2), 'reasons' => $reasons];
    }
}
