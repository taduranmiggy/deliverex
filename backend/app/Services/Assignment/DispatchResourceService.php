<?php

namespace App\Services\Assignment;

use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Support\AssignmentScheduleConflict;

class DispatchResourceService
{
    public function optionsForJob(JobOrder $jobOrder): array
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
            ->where(function ($q) {
                $q->where('status', '!=', 'inactive')
                    ->orWhereNull('status');
            })
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
}
