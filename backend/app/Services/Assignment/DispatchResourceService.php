<?php

namespace App\Services\Assignment;

use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Driver\DriverAvailabilityService;
use App\Services\Fleet\VehicleAvailabilityService;
use App\Support\AssignmentScheduleConflict;

class DispatchResourceService
{
    public function __construct(
        private DriverAvailabilityService $driverAvailability,
        private VehicleAvailabilityService $vehicleAvailability,
    ) {
    }

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
            'availability' => $this->driverAvailability->deriveAvailability($driver),
            'status' => $driver->status ?? 'active',
        ])->values()->all();

        $vehicles = $this->eligibleVehicles($jobOrder)
            ->filter(fn (Vehicle $vehicle) => $this->isFeasible($vehicle, $requiredVolume))
            ->map(fn (Vehicle $vehicle) => [
                'id' => $vehicle->id,
                'plate_no' => $vehicle->plate_no,
                'status' => $this->vehicleAvailability->deriveStatus($vehicle),
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
            ->get()
            ->filter(function (Driver $driver) use ($jobOrder) {
                if ($this->driverAvailability->isAdminUnavailable($driver)) {
                    return false;
                }

                if (! $this->driverAvailability->isAssignable($driver)) {
                    return false;
                }

                return ! AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder);
            })
            ->values();
    }

    private function eligibleVehicles(JobOrder $jobOrder)
    {
        return Vehicle::query()
            ->with('vehicleType')
            ->get()
            ->filter(function (Vehicle $vehicle) use ($jobOrder) {
                if (! $this->vehicleAvailability->isAssignable($vehicle)) {
                    return false;
                }

                return ! AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder);
            })
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
