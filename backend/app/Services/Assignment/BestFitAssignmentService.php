<?php

namespace App\Services\Assignment;

use App\Models\DriverVehicleAssignment;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Support\AssignmentScheduleConflict;
use App\Support\VehicleCapacity;

class BestFitAssignmentService
{
    private const SCORE_MAX = 100;
    private const DIVERSITY_WINDOW_DAYS = 7;

    /**
     * Rank driver × vehicle pairs for a job using a best-fit score (higher is better).
     */
    public function recommend(JobOrder $jobOrder): array
    {
        $jobOrder->loadMissing('preferredVehicleType');
        $drivers = $this->eligibleDrivers($jobOrder);
        $vehicles = $this->eligibleVehicles($jobOrder);
        $driverDiversity = $this->driverDiversityStats($drivers->pluck('id')->all());

        $requiredVolume = $jobOrder->load_volume_m3 !== null
            ? (float) $jobOrder->load_volume_m3
            : ($jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null);

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

                ['score' => $score, 'reasons' => $reasons, 'factors' => $factors] = $this->scorePair(
                    $jobOrder,
                    $driverModel,
                    $vehicleModel,
                    $requiredVolume,
                    $driverDiversity[$driverModel->id] ?? [],
                );

                $vehicleCapacity = $vehicleModel->cbm_capacity
                    ?? $vehicleModel->max_volume_m3
                    ?? $vehicleModel->rounded_cbm_capacity
                    ?? null;
                $unusedCapacity = $requiredVolume !== null && $vehicleCapacity !== null
                    ? round((float) $vehicleCapacity - $requiredVolume, 3)
                    : null;
                $loadEfficiencyPercent = $requiredVolume !== null
                    && $requiredVolume > 0
                    && $vehicleCapacity !== null
                    && (float) $vehicleCapacity > 0
                    ? (int) round(min(1, max(0, $requiredVolume / (float) $vehicleCapacity)) * 100)
                    : null;

                $recommendations[] = [
                    'driver_id'        => $driverModel->id,
                    'driver_user_id'   => $driverModel->user_id,
                    'driver_has_account' => (bool) $driverModel->user_id,
                    'driver_name'      => $driverModel->full_name ?: $driverModel->user?->name,
                    'vehicle_id'       => $vehicleModel->id,
                    'vehicle_plate'    => $vehicleModel->plate_no,
                    'vehicle_type'     => $vehicleModel->vehicleType?->name ?? $vehicleModel->type,
                    'vehicle_capacity' => $vehicleModel->capacity,
                    'vehicle_cbm_capacity' => $vehicleCapacity !== null ? (float) $vehicleCapacity : null,
                    'load_volume' => $requiredVolume,
                    'unused_capacity' => $unusedCapacity,
                    'load_efficiency_percent' => $loadEfficiencyPercent,
                    'score'            => $score,
                    'score_max'        => self::SCORE_MAX,
                    'factors'          => $factors,
                    'reasons'          => $reasons,
                    'feasible'         => true,
                    'driver_recent_assignments' => $driverDiversity[$driverModel->id]['recent_assignments'] ?? 0,
                    'driver_last_assigned_at'   => $driverDiversity[$driverModel->id]['last_assigned_at'] ?? null,
                ];
            }
        }

        usort($recommendations, function ($a, $b) {
            // Keep existing scoring as primary ranking signal.
            $scoreCmp = $b['score'] <=> $a['score'];
            if ($scoreCmp !== 0) {
                return $scoreCmp;
            }

            // Diversity tie-breaker: prefer drivers with fewer recent assignments.
            $loadCmp = ($a['driver_recent_assignments'] ?? 0) <=> ($b['driver_recent_assignments'] ?? 0);
            if ($loadCmp !== 0) {
                return $loadCmp;
            }

            // Then prefer the driver who has not been assigned recently.
            $aLast = $a['driver_last_assigned_at'] ? strtotime((string) $a['driver_last_assigned_at']) : 0;
            $bLast = $b['driver_last_assigned_at'] ? strtotime((string) $b['driver_last_assigned_at']) : 0;

            return $aLast <=> $bLast;
        });

        $recommendations = $this->diversifyByDriver($recommendations);

        return array_slice($recommendations, 0, 10);
    }

    public function overrideOptions(JobOrder $jobOrder): array
    {
        $requiredVolume = $jobOrder->load_volume_m3 !== null
            ? (float) $jobOrder->load_volume_m3
            : ($jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null);

        $drivers = $this->eligibleDrivers($jobOrder)->map(fn (Driver $driver) => [
            'id' => $driver->id,
            'user_id' => $driver->user_id,
            'has_login_account' => (bool) $driver->user_id,
            'name' => $driver->full_name ?: $driver->user?->name ?: ('Driver #'.$driver->id),
            'availability' => $driver->availability ?? 'available',
            'status' => $driver->status ?? 'active',
        ])->values()->all();

        $vehicles = $this->eligibleVehicles($jobOrder)
            ->filter(fn (Vehicle $vehicle) => $this->isFeasible($vehicle, $requiredVolume))
            ->map(fn (Vehicle $vehicle) => [
                'id' => $vehicle->id,
                'plate_no' => $vehicle->plate_no,
                'status' => $vehicle->status ?? 'available',
                'vehicle_type' => $vehicle->vehicleType?->name ?? $vehicle->type,
                'cbm_capacity' => $vehicle->cbm_capacity ?? $vehicle->max_volume_m3 ?? $vehicle->rounded_cbm_capacity,
            ])->values()->all();

        return [
            'drivers' => $drivers,
            'vehicles' => $vehicles,
        ];
    }

    private function eligibleDrivers(JobOrder $jobOrder)
    {
        return Driver::query()
            ->with('user')
            // Exclude inactive drivers; treat NULL status as available (auto-provisioned accounts)
            ->where(function ($q) {
                $q->where('status', '!=', 'inactive')
                  ->orWhereNull('status');
            })
            // Exclude drivers explicitly marked offline; treat NULL availability as available
            ->where(function ($q) {
                $q->where('availability', '!=', 'offline')
                  ->orWhereNull('availability');
            })
            ->get()
            ->filter(fn (Driver $d) => ! AssignmentScheduleConflict::hasDriverConflict($d->id, $jobOrder))
            ->values();
    }

    private function eligibleVehicles(JobOrder $jobOrder)
    {
        return Vehicle::query()
            ->with('vehicleType')
            ->whereNotIn('status', ['maintenance', 'unavailable', 'inactive'])
            ->get()
            ->filter(fn (Vehicle $v) => ! AssignmentScheduleConflict::hasVehicleConflict($v->id, $jobOrder))
            ->values();
    }

    private function driverDiversityStats(array $driverIds): array
    {
        if (empty($driverIds)) {
            return [];
        }

        $rows = DispatchAssignment::query()
            ->selectRaw('driver_id, COUNT(*) as recent_assignments, MAX(assigned_at) as last_assigned_at')
            ->whereIn('driver_id', $driverIds)
            ->whereNotNull('assigned_at')
            ->where('assigned_at', '>=', now()->subDays(self::DIVERSITY_WINDOW_DAYS))
            ->groupBy('driver_id')
            ->get();

        $stats = [];
        foreach ($rows as $row) {
            $stats[(int) $row->driver_id] = [
                'recent_assignments' => (int) ($row->recent_assignments ?? 0),
                'last_assigned_at' => $row->last_assigned_at,
            ];
        }

        return $stats;
    }

    private function diversifyByDriver(array $recommendations): array
    {
        $seenDrivers = [];
        $uniqueFirstPass = [];
        $remainder = [];

        foreach ($recommendations as $rec) {
            $driverId = (int) ($rec['driver_id'] ?? 0);
            if ($driverId > 0 && ! isset($seenDrivers[$driverId])) {
                $seenDrivers[$driverId] = true;
                $uniqueFirstPass[] = $rec;
                continue;
            }
            $remainder[] = $rec;
        }

        return array_merge($uniqueFirstPass, $remainder);
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
        array $driverDiversity = []
    ): array {
        $factors = [];

        $maxWeight = $vehicle->max_weight_kg !== null
            ? (float) $vehicle->max_weight_kg
            : VehicleCapacity::labelToKg($vehicle->capacity);
        $maxVolume = $vehicle->cbm_capacity !== null
            ? (float) $vehicle->cbm_capacity
            : ($vehicle->max_volume_m3 !== null
                ? (float) $vehicle->max_volume_m3
                : ($vehicle->rounded_cbm_capacity !== null ? (float) $vehicle->rounded_cbm_capacity : null));

        // 1. Vehicle Capacity Match (max 25)
        $capacityMax = 25;
        $capacityContribution = 18;
        $capacityMatched = true;
        $capacityDetail = 'Meets minimum capacity requirements';

        if ($maxVolume !== null && $requiredVolumeM3 !== null && $requiredVolumeM3 > 0) {
            $utilization = $requiredVolumeM3 / $maxVolume;
            $utilScore = 15 * (1 - min(1, abs(0.82 - $utilization) / 0.5));
            $unused = round($maxVolume - $requiredVolumeM3, 3);
            $tightScore = max(0, 10 - min(10, $unused));
            $capacityContribution = (int) round(min($capacityMax, $utilScore + $tightScore));
            $capacityMatched = $utilization <= 1;
            $capacityDetail = 'Load at '.round($utilization * 100).'% of vehicle volume · '.$unused.' m³ unused';
        } elseif ($maxWeight !== null && $requiredVolumeM3 !== null && $requiredVolumeM3 > 0) {
            $capacityContribution = 14;
            $capacityDetail = 'Weight capacity metadata used as fallback signal';
        }

        $factors[] = $this->factor(
            'vehicle_capacity_match',
            'Vehicle Capacity Match',
            $capacityMatched,
            $capacityContribution,
            $capacityMax,
            $capacityDetail,
        );

        // 2. Driver Available (max 25)
        $driverMax = 25;
        $activeCount = DispatchAssignment::where('driver_id', $driver->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        $driverContribution = 10;
        $driverMatched = false;
        $driverDetail = 'Driver workload considered';

        if ($driver->availability === 'available' && $activeCount === 0) {
            $driverContribution = 25;
            $driverMatched = true;
            $driverDetail = 'Driver is available with no other active assignments';
        } elseif ($driver->availability === 'available') {
            $driverContribution = max(12, 22 - min(10, ($activeCount - 1) * 3));
            $driverMatched = true;
            $driverDetail = $activeCount === 1
                ? 'Driver is available with one other active assignment'
                : "Driver is available · {$activeCount} active assignments";
        } elseif ($driver->availability === 'busy' && $activeCount > 0) {
            $driverContribution = 15;
            $driverMatched = true;
            $driverDetail = 'Driver is busy but free for this schedule window';
        }

        $primaryAssignment = DriverVehicleAssignment::query()
            ->where('driver_id', $driver->id)
            ->where('vehicle_id', $vehicle->id)
            ->where('is_primary', true)
            ->where('status', 'active')
            ->exists();
        if ($primaryAssignment) {
            $driverContribution = min($driverMax, $driverContribution + 3);
            $driverDetail .= ' · primary pairing on this vehicle';
        }

        if (! empty($jobOrder->job_requirements) && $driver->availability === 'available') {
            $driverContribution = min($driverMax, $driverContribution + 2);
            $driverDetail .= ' · preferred for special handling';
        }

        $recentAssignments = (int) ($driverDiversity['recent_assignments'] ?? 0);
        if ($recentAssignments > 0) {
            $rotationPenalty = min(10, $recentAssignments * 2);
            $driverContribution = max(0, $driverContribution - $rotationPenalty);
            $driverDetail .= " - rotation penalty for {$recentAssignments} recent assignment".($recentAssignments === 1 ? '' : 's');
        }

        $factors[] = $this->factor(
            'driver_available',
            'Driver Available',
            $driverMatched,
            $driverContribution,
            $driverMax,
            $driverDetail,
        );

        // 3. Load Efficiency (max 20)
        $efficiencyMax = 20;
        $efficiencyContribution = 10;
        $efficiencyMatched = true;
        $efficiencyDetail = 'Load efficiency not available (missing volume or capacity metadata)';

        if ($requiredVolumeM3 !== null && $requiredVolumeM3 > 0 && $maxVolume !== null && $maxVolume > 0) {
            $efficiencyRatio = min(1, max(0, $requiredVolumeM3 / $maxVolume));
            $efficiencyPercent = (int) round($efficiencyRatio * 100);
            $efficiencyContribution = (int) round($efficiencyMax * $efficiencyRatio);
            $efficiencyMatched = $efficiencyRatio >= 0.6;
            $efficiencyDetail = 'Load efficiency: '.$efficiencyPercent.'%';
        }

        $factors[] = $this->factor(
            'load_efficiency',
            'Load Efficiency',
            $efficiencyMatched,
            $efficiencyContribution,
            $efficiencyMax,
            $efficiencyDetail,
        );

        // 4. Vehicle Type Match (max 10) — binary pass/fail on exact required type
        $typeMax = 10;
        $typeContribution = 0;
        $typeMatched = false;
        $requiredTypeName = $jobOrder->preferredVehicleType?->name ?? $jobOrder->vehicle_type_required;
        $vehicleTypeName = $vehicle->vehicleType?->name ?? $vehicle->type;

        if ($this->normalizeVehicleTypeName($requiredTypeName) === null) {
            $typeDetail = 'Job order does not specify a required vehicle type.';
        } elseif ($this->normalizeVehicleTypeName($vehicleTypeName) === null) {
            $typeDetail = 'Vehicle type is not configured for this fleet unit.';
        } elseif ($this->vehicleTypesMatch($requiredTypeName, $vehicleTypeName)) {
            $typeContribution = $typeMax;
            $typeMatched = true;
            $typeDetail = 'Vehicle type exactly matches the Job Order requirement.';
        } else {
            $typeDetail = 'Vehicle type does not match the Job Order requirement.';
        }

        $factors[] = $this->factor(
            'vehicle_type_match',
            'Vehicle Type Match',
            $typeMatched,
            $typeContribution,
            $typeMax,
            $typeDetail,
        );

        // 5. Schedule Match (max 10)
        $scheduleMax = 10;
        $scheduleContribution = 5;
        $scheduleMatched = true;
        $scheduleDetail = 'No schedule conflict for driver or vehicle';

        if ($vehicle->status === 'available') {
            $scheduleContribution += 2;
            $scheduleDetail = 'Vehicle is available · no schedule conflict';
        } elseif ($vehicle->status === 'assigned') {
            $scheduleContribution += 1;
            $scheduleDetail = 'Vehicle assigned elsewhere but schedule does not conflict';
        }

        $priorityBonus = match ($jobOrder->priority) {
            'urgent' => 3,
            'high'   => 2,
            'low'    => 1,
            default  => 1,
        };
        $scheduleContribution += $priorityBonus;

        if ($jobOrder->scheduled_start) {
            $hours = $jobOrder->scheduled_start->diffInHours(now(), false);
            if ($hours > 0 && $hours < 72) {
                $timingBonus = (int) max(0, min(2, 2 - floor($hours / 24)));
                $scheduleContribution += $timingBonus;
                $scheduleDetail .= ' · job in '.round($hours).' hours';
            }
        }

        if (! empty($jobOrder->specification_size)) {
            $scheduleContribution = min($scheduleMax, $scheduleContribution + 1);
            $scheduleDetail .= ' · specification considered';
        }

        $scheduleContribution = min($scheduleMax, $scheduleContribution);

        $factors[] = $this->factor(
            'schedule_match',
            'Schedule Match',
            $scheduleMatched,
            $scheduleContribution,
            $scheduleMax,
            $scheduleDetail,
        );

        $score = min(self::SCORE_MAX, array_sum(array_column($factors, 'contribution')));
        $reasons = array_values(array_filter(array_map(
            fn (array $factor) => $factor['matched'] ? $factor['detail'] : null,
            $factors,
        )));

        if (empty($reasons)) {
            $reasons[] = 'Meets capacity and schedule requirements';
        }

        return [
            'score'   => (int) round($score),
            'factors' => $factors,
            'reasons' => $reasons,
        ];
    }

    private function factor(
        string $key,
        string $label,
        bool $matched,
        int $contribution,
        int $max,
        string $detail
    ): array {
        return [
            'key'          => $key,
            'label'        => $label,
            'matched'      => $matched,
            'contribution' => min($max, max(0, $contribution)),
            'max'          => $max,
            'detail'       => $detail,
        ];
    }

    private function normalizeVehicleTypeName(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = mb_strtolower(trim($value));

        return $normalized === '' ? null : $normalized;
    }

    private function vehicleTypesMatch(?string $requiredTypeName, ?string $vehicleTypeName): bool
    {
        $required = $this->normalizeVehicleTypeName($requiredTypeName);
        $actual = $this->normalizeVehicleTypeName($vehicleTypeName);

        return $required !== null && $actual !== null && $required === $actual;
    }

}
