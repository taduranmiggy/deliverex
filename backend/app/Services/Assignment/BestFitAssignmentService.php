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
    private const SCORE_MAX = 100;

    /**
     * Rank driver × vehicle pairs for a job using a best-fit score (higher is better).
     */
    public function recommend(JobOrder $jobOrder): array
    {
        $drivers = Driver::query()
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
        $preferredTypeName = $this->resolvePreferredTypeName($clientPreference);

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
                    $clientPreference,
                    $preferredTypeName,
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
                    'client_preference_match' => $this->vehicleMatchesPreference($vehicleModel, $clientPreference, $preferredTypeName),
                    'score'            => $score,
                    'score_max'        => self::SCORE_MAX,
                    'factors'          => $factors,
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
        ?ClientQuarryVehiclePreference $clientPreference,
        ?string $preferredTypeName = null
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

        $factors[] = $this->factor(
            'driver_available',
            'Driver Available',
            $driverMatched,
            $driverContribution,
            $driverMax,
            $driverDetail,
        );

        // 3. Client Preference Match (max 20)
        $preferenceMax = 20;
        $preferenceContribution = 10;
        $preferenceMatched = true;
        $preferenceDetail = 'No client vehicle preference configured';

        if ($clientPreference && $clientPreference->vehicle_type_id) {
            $preferenceName = $preferredTypeName ?? $this->resolvePreferredTypeName($clientPreference) ?? 'preferred type';
            if ($this->vehicleMatchesPreference($vehicle, $clientPreference, $preferredTypeName)) {
                $preferenceContribution = 20;
                $preferenceMatched = true;
                $preferenceDetail = 'Matches client preference ('.$preferenceName.')';
            } else {
                $preferenceContribution = 0;
                $preferenceMatched = false;
                $preferenceDetail = 'Does not match client preference ('.$preferenceName.')';
            }
        }

        $factors[] = $this->factor(
            'client_preference_match',
            'Client Preference Match',
            $preferenceMatched,
            $preferenceContribution,
            $preferenceMax,
            $preferenceDetail,
        );

        // 4. Vehicle Type Match (max 15)
        $typeMax = 15;
        $typeContribution = 10;
        $typeMatched = true;
        $typeDetail = 'General fleet vehicle accepted for this material';

        $materialType = strtolower((string) ($jobOrder->material_type ?? ''));
        if ($materialType !== '') {
            $vehicleType = strtolower((string) ($vehicle->vehicleType?->name ?? $vehicle->type ?? ''));
            $keywords = [];
            if (str_contains($materialType, 'rock') || str_contains($materialType, 'aggregate') || str_contains($materialType, 'sand') || str_contains($materialType, 'gravel') || str_contains($materialType, 'soil')) {
                $keywords = ['dump', 'tipper'];
            } elseif (str_contains($materialType, 'cement') || str_contains($materialType, 'concrete')) {
                $keywords = ['mixer', 'bulk', 'silo'];
            }

            $keywordHit = false;
            if ($keywords) {
                foreach ($keywords as $kw) {
                    if (str_contains($vehicleType, $kw)) {
                        $keywordHit = true;
                        break;
                    }
                }
            }

            if ($keywordHit) {
                $typeContribution = 15;
                $typeMatched = true;
                $typeDetail = 'Vehicle type suits material ('.$jobOrder->material_type.')';
            } else {
                $typeContribution = 5;
                $typeMatched = false;
                $typeDetail = 'Vehicle type is not ideal for material ('.$jobOrder->material_type.')';
            }
        }

        $factors[] = $this->factor(
            'vehicle_type_match',
            'Vehicle Type Match',
            $typeMatched,
            $typeContribution,
            $typeMax,
            $typeDetail,
        );

        // 5. Schedule Match (max 15)
        $scheduleMax = 15;
        $scheduleContribution = 8;
        $scheduleMatched = true;
        $scheduleDetail = 'No schedule conflict for driver or vehicle';

        if ($vehicle->status === 'available') {
            $scheduleContribution += 3;
            $scheduleDetail = 'Vehicle is available · no schedule conflict';
        } elseif ($vehicle->status === 'assigned') {
            $scheduleContribution += 1;
            $scheduleDetail = 'Vehicle assigned elsewhere but schedule does not conflict';
        }

        $priorityBonus = match ($jobOrder->priority) {
            'urgent' => 4,
            'high'   => 3,
            'low'    => 1,
            default  => 2,
        };
        $scheduleContribution += $priorityBonus;

        if ($jobOrder->scheduled_start) {
            $hours = $jobOrder->scheduled_start->diffInHours(now(), false);
            if ($hours > 0 && $hours < 72) {
                $timingBonus = (int) max(0, min(4, 4 - floor($hours / 18)));
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

    private function resolveClientPreference(JobOrder $jobOrder): ?ClientQuarryVehiclePreference
    {
        // Existing client: use the stored master-data preference mapping.
        if ($jobOrder->client_id) {
            $preference = ClientQuarryVehiclePreference::query()
                ->where('client_id', $jobOrder->client_id)
                ->where('status', 'active')
                ->where('is_default', true)
                ->first();

            if ($preference) {
                return $preference;
            }
        }

        // New/custom client (or existing client without a saved mapping): fall back
        // to the per-job preferred vehicle type captured on the job order itself.
        if ($jobOrder->preferred_vehicle_type_id) {
            return new ClientQuarryVehiclePreference([
                'client_id'       => $jobOrder->client_id,
                'quarry_id'       => $jobOrder->quarry_id,
                'vehicle_type_id' => $jobOrder->preferred_vehicle_type_id,
                'is_default'      => true,
                'status'          => 'active',
            ]);
        }

        return null;
    }

    private function resolvePreferredTypeName(?ClientQuarryVehiclePreference $clientPreference): ?string
    {
        if (! $clientPreference || ! $clientPreference->vehicle_type_id) {
            return null;
        }

        $type = $clientPreference->relationLoaded('vehicleType') && $clientPreference->vehicleType
            ? $clientPreference->vehicleType
            : \App\Models\VehicleType::query()->find($clientPreference->vehicle_type_id);

        return $type?->name;
    }

    /**
     * Determine whether a vehicle matches the preferred vehicle type. Primary match is
     * by foreign key; a name-based fallback covers fleets where vehicles only carry the
     * legacy `type` label and are not yet linked to the vehicle_types master record.
     */
    private function vehicleMatchesPreference(
        Vehicle $vehicle,
        ?ClientQuarryVehiclePreference $clientPreference,
        ?string $preferredTypeName = null
    ): bool {
        if (! $clientPreference || ! $clientPreference->vehicle_type_id) {
            return false;
        }

        if ($vehicle->vehicle_type_id !== null
            && (int) $vehicle->vehicle_type_id === (int) $clientPreference->vehicle_type_id) {
            return true;
        }

        $preferredTypeName ??= $this->resolvePreferredTypeName($clientPreference);
        if (! $preferredTypeName) {
            return false;
        }

        $vehicleTypeName = $vehicle->vehicleType?->name ?? $vehicle->type;

        return $vehicleTypeName !== null
            && strtolower(trim((string) $vehicleTypeName)) === strtolower(trim($preferredTypeName));
    }
}
