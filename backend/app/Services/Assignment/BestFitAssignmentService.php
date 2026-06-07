<?php

namespace App\Services\Assignment;

use App\Models\ClientQuarryVehiclePreference;
use App\Models\DriverVehicleAssignment;
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
            ->where('status', '!=', 'inactive')
            ->where('availability', '!=', 'offline')
            ->get()
            ->filter(fn (Driver $d) => ! AssignmentScheduleConflict::hasDriverConflict($d->id, $jobOrder));

        $vehicles = Vehicle::query()
            ->with('vehicleType')
            ->whereNotIn('status', ['maintenance', 'unavailable', 'inactive'])
            ->get()
            ->filter(fn (Vehicle $v) => ! AssignmentScheduleConflict::hasVehicleConflict($v->id, $jobOrder));

        $requiredVolume = $jobOrder->load_volume_m3 !== null
            ? (float) $jobOrder->load_volume_m3
            : ($jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null);

        $clientPreference = $this->resolveClientPreference($jobOrder);

        $recommendations = [];

        foreach ($drivers as $driver) {
            foreach ($vehicles as $vehicle) {
                $driverModel = $driver instanceof Driver ? $driver : null;
                $vehicleModel = $vehicle instanceof Vehicle ? $vehicle : null;
                if (! $driverModel || ! $vehicleModel) {
                    continue;
                }
                if (! $this->isFeasible($vehicleModel, $requiredVolume)) {
                    continue;
                }

                ['score' => $score, 'reasons' => $reasons] = $this->scorePair(
                    $jobOrder,
                    $driverModel,
                    $vehicleModel,
                    $requiredVolume,
                    $clientPreference,
                );

                $vehicleCapacity = $vehicleModel->cbm_capacity
                    ?? $vehicleModel->max_volume_m3
                    ?? $vehicleModel->rounded_cbm_capacity
                    ?? null;
                $unusedCapacity = $requiredVolume !== null && $vehicleCapacity !== null
                    ? round((float) $vehicleCapacity - $requiredVolume, 3)
                    : null;

                $recommendations[] = [
                    'driver_id'        => $driverModel->id,
                    'driver_name'      => $driverModel->full_name ?: $driverModel->user?->name,
                    'vehicle_id'       => $vehicleModel->id,
                    'vehicle_plate'    => $vehicleModel->plate_no,
                    'vehicle_type'     => $vehicleModel->vehicleType?->name ?? $vehicleModel->type,
                    'vehicle_capacity' => $vehicleModel->capacity,
                    'vehicle_cbm_capacity' => $vehicleCapacity !== null ? (float) $vehicleCapacity : null,
                    'load_volume' => $requiredVolume,
                    'unused_capacity' => $unusedCapacity,
                    'client_preference_match' => $this->isClientPreferenceMatch($vehicleModel, $clientPreference),
                    'score'            => $score,
                    'reasons'          => $reasons,
                    'feasible'         => true,
                ];
            }
        }

        usort($recommendations, fn ($a, $b) => $b['score'] <=> $a['score']);

        return array_slice($recommendations, 0, 10);
    }

    private function isFeasible(Vehicle $vehicle, ?float $requiredVolumeM3): bool
    {
        $maxVol = $vehicle->cbm_capacity !== null
            ? (float) $vehicle->cbm_capacity
            : ($vehicle->max_volume_m3 !== null
                ? (float) $vehicle->max_volume_m3
                : ($vehicle->rounded_cbm_capacity !== null ? (float) $vehicle->rounded_cbm_capacity : null));
        if ($requiredVolumeM3 !== null && $maxVol !== null && $requiredVolumeM3 > $maxVol) {
            return false;
        }

        return true;
    }

    private function scorePair(
        JobOrder $jobOrder,
        Driver $driver,
        Vehicle $vehicle,
        ?float $requiredVolumeM3,
        ?ClientQuarryVehiclePreference $clientPreference
    ): array {
        $score   = 30.0;
        $reasons = [];

        // --- Vehicle scoring ---
        $materialType = strtolower((string) ($jobOrder->material_type ?? ''));
        if ($materialType !== '') {
            $vehicleType = strtolower((string) ($vehicle->vehicleType?->name ?? $vehicle->type ?? ''));
            $keywords = [];
            if (str_contains($materialType, 'rock') || str_contains($materialType, 'aggregate') || str_contains($materialType, 'sand') || str_contains($materialType, 'gravel') || str_contains($materialType, 'soil')) {
                $keywords = ['dump', 'tipper'];
            } elseif (str_contains($materialType, 'cement') || str_contains($materialType, 'concrete')) {
                $keywords = ['mixer', 'bulk', 'silo'];
            }
            if ($keywords) {
                foreach ($keywords as $kw) {
                    if (str_contains($vehicleType, $kw)) {
                        $score += 14;
                        $reasons[] = 'Vehicle type is suitable for selected material ('.$jobOrder->material_type.')';
                        break;
                    }
                }
            }
        }

        $maxWeight = $vehicle->max_weight_kg !== null
            ? (float) $vehicle->max_weight_kg
            : VehicleCapacity::labelToKg($vehicle->capacity);
        $maxVolume = $vehicle->cbm_capacity !== null
            ? (float) $vehicle->cbm_capacity
            : ($vehicle->max_volume_m3 !== null
                ? (float) $vehicle->max_volume_m3
                : ($vehicle->rounded_cbm_capacity !== null ? (float) $vehicle->rounded_cbm_capacity : null));
        $jobVolume = $requiredVolumeM3;
        if ($maxVolume !== null && $jobVolume !== null && $jobVolume > 0) {
            $utilization = $jobVolume / $maxVolume;
            if ($utilization <= 1) {
                $score += 10 * (1 - abs(0.82 - $utilization));
                $reasons[] = 'Load utilization at '.round($utilization * 100).'% of vehicle volume capacity';
                $unused = round($maxVolume - $jobVolume, 3);
                $score += max(0, 10 - $unused);
                $reasons[] = 'Unused capacity: '.$unused.' m3 (tight-fit scoring)';
            }
        } elseif ($maxWeight !== null && $jobVolume !== null && $jobVolume > 0) {
            // Fallback where only weight metadata is available on vehicles.
            $score += 4;
            $reasons[] = 'Vehicle weight metadata considered as fallback capacity signal';
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

        // Special handling notes increase scoring weight for more available resources.
        if (! empty($jobOrder->job_requirements) && $driver->availability === 'available') {
            $score += 4;
            $reasons[] = 'Special handling instructions detected; preferred fully available driver';
        }

        if (! empty($jobOrder->specification_size)) {
            $score += 3;
            $reasons[] = 'Specification/size considered during matching ('.$jobOrder->specification_size.')';
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

        if ($clientPreference && $clientPreference->vehicle_type_id) {
            if ((int) $vehicle->vehicle_type_id === (int) $clientPreference->vehicle_type_id) {
                $score += 18;
                $reasons[] = 'Matches client preferred vehicle type';
            } else {
                $score -= 6;
                $reasons[] = 'Does not match client preferred vehicle type';
            }
        }

        $primaryAssignment = DriverVehicleAssignment::query()
            ->where('driver_id', $driver->id)
            ->where('vehicle_id', $vehicle->id)
            ->where('is_primary', true)
            ->where('status', 'active')
            ->exists();
        if ($primaryAssignment) {
            $score += 10;
            $reasons[] = 'Driver has primary assignment on this vehicle';
        }

        if (empty($reasons)) {
            $reasons[] = 'Meets capacity and schedule requirements';
        }

        return ['score' => round(max(0, $score), 2), 'reasons' => $reasons];
    }

    private function resolveClientPreference(JobOrder $jobOrder): ?ClientQuarryVehiclePreference
    {
        if (! $jobOrder->client_id) {
            return null;
        }

        return ClientQuarryVehiclePreference::query()
            ->where('client_id', $jobOrder->client_id)
            ->where('status', 'active')
            ->where('is_default', true)
            ->first();
    }

    private function isClientPreferenceMatch(Vehicle $vehicle, ?ClientQuarryVehiclePreference $clientPreference): bool
    {
        if (! $clientPreference || ! $clientPreference->vehicle_type_id) {
            return false;
        }

        return (int) $vehicle->vehicle_type_id === (int) $clientPreference->vehicle_type_id;
    }
}
