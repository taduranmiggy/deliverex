<?php

namespace App\Services\Assignment;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Driver\DriverAvailabilityService;
use App\Services\Fleet\VehicleAvailabilityService;
use App\Support\AssignmentScheduleConflict;
use App\Support\DeliveryStatus;
use App\Support\DriverLicenseValidator;
use App\Support\VehicleTypeMatcher;
use App\Support\VehicleVolumeResolver;

class BestFitPipelineDiagnostic
{
    public function __construct(
        private DriverAvailabilityService $driverAvailability,
        private VehicleAvailabilityService $vehicleAvailability,
        private BestFitAssignmentService $bestFit,
        private BestFitVehicleFilterAudit $vehicleFilterAudit,
    ) {
    }

    /** @return array<string, mixed> */
    public function analyze(JobOrder $jobOrder): array
    {
        $jobOrder->loadMissing('preferredVehicleType', 'quarry', 'materialTypeRef');

        $requiredVolume = $this->bestFitRequiredVolume($jobOrder);
        $requiredTypeName = $jobOrder->preferredVehicleType?->name ?? $jobOrder->vehicle_type_required;
        $requiredTypeNormalized = VehicleTypeMatcher::normalize($requiredTypeName);

        $allDrivers = Driver::query()->with('user')->get();
        $allVehicles = Vehicle::query()->with('vehicleType')->get();

        $driverStages = $this->analyzeDrivers($jobOrder, $allDrivers);
        $vehicleStages = $this->analyzeVehicles($jobOrder, $allVehicles, $requiredTypeNormalized, $requiredVolume);
        $vehicleAudit = $this->vehicleFilterAudit->audit($jobOrder, $allVehicles);

        $eligibleDrivers = $driverStages['eligible'];
        $eligibleVehicles = $vehicleStages['eligible'];

        $pairCount = 0;
        if ($eligibleDrivers->isNotEmpty() && $eligibleVehicles->isNotEmpty()) {
            $pairCount = $eligibleDrivers->count() * $eligibleVehicles->count();
        }

        $recommendations = $this->bestFit->recommend($jobOrder);

        return [
            'job_order_id' => $jobOrder->id,
            'job_requirements' => [
                'vehicle_type_id'   => $jobOrder->preferred_vehicle_type_id,
                'vehicle_type_name' => $requiredTypeName,
                'vehicle_type_normalized' => $requiredTypeNormalized,
                'material_type'     => $jobOrder->material_type,
                'load_volume_m3'    => $requiredVolume,
                'scheduled_start'   => $jobOrder->scheduled_start?->toIso8601String(),
                'scheduled_end'     => $jobOrder->scheduled_end?->toIso8601String(),
            ],
            'summary' => [
                'total_drivers'           => $allDrivers->count(),
                'eligible_drivers'        => $eligibleDrivers->count(),
                'total_vehicles'          => $allVehicles->count(),
                'eligible_vehicles'       => $eligibleVehicles->count(),
                'theoretical_pair_count'  => $pairCount,
                'recommendation_count'    => count($recommendations),
            ],
            'drivers' => $this->serializeStage($driverStages),
            'vehicles' => $this->serializeStage($vehicleStages),
            'vehicle_audit' => $vehicleAudit,
            'bottleneck' => $this->detectBottleneck($driverStages, $vehicleStages, $pairCount),
        ];
    }

    /** @param  array<string, mixed>  $stage */
    private function serializeStage(array $stage): array
    {
        unset($stage['eligible']);

        return $stage;
    }

    /** @return array<string, mixed> */
    private function analyzeDrivers(JobOrder $jobOrder, $allDrivers): array
    {
        $removed = [
            'inactive_status'      => [],
            'license_missing'      => [],
            'license_expired'      => [],
            'active_assignment'    => [],
        ];

        $softScoring = [
            'license_incomplete' => [],
            'admin_offline'      => [],
            'schedule_conflict'  => [],
        ];

        $eligible = collect();

        foreach ($allDrivers as $driver) {
            $name = $driver->full_name ?: $driver->user?->name ?: ('Driver #'.$driver->id);

            if (in_array($driver->status, ['inactive', 'suspended', 'archived'], true)) {
                $removed['inactive_status'][] = $this->removal($name, $driver, 'status', $driver->status, 'active');
                continue;
            }

            $licenseStatus = DriverLicenseValidator::status($driver);
            if ($licenseStatus === DriverLicenseValidator::STATUS_MISSING) {
                $removed['license_missing'][] = $this->removal($name, $driver, 'license_no', $driver->license_no, 'non-null non-empty');
                continue;
            }
            if ($licenseStatus === DriverLicenseValidator::STATUS_EXPIRED) {
                $removed['license_expired'][] = $this->removal(
                    $name,
                    $driver,
                    'license_expiry',
                    $driver->license_expiry?->toDateString(),
                    'date after today',
                );
                continue;
            }

            if ($this->driverAvailability->hasActiveAssignments($driver)) {
                $blocking = DispatchAssignment::query()
                    ->where('driver_id', $driver->id)
                    ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
                    ->get(['id', 'status', 'job_order_id', 'completed_at']);

                $removed['active_assignment'][] = array_merge(
                    $this->removal($name, $driver, 'active_assignments', $blocking->count(), '0'),
                    ['blocking_assignments' => $blocking->map(fn ($a) => [
                        'assignment_id' => $a->id,
                        'status' => $a->status,
                        'job_order_id' => $a->job_order_id,
                        'completed_at' => $a->completed_at,
                    ])->values()->all()],
                );
                continue;
            }

            if ($licenseStatus === DriverLicenseValidator::STATUS_INCOMPLETE) {
                $softScoring['license_incomplete'][] = $this->removal($name, $driver, 'license_expiry', null, 'valid future date (scored with penalty)');
            }

            if ($this->driverAvailability->isAdminUnavailable($driver)) {
                $softScoring['admin_offline'][] = $this->removal(
                    $name,
                    $driver,
                    'availability/status',
                    ($driver->availability ?? 'available').' / '.($driver->status ?? 'available'),
                    'available (scored with lower availability)',
                );
            }

            if (AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder)) {
                $softScoring['schedule_conflict'][] = $this->removal(
                    $name,
                    $driver,
                    'schedule_overlap',
                    'conflicts with active assignment window',
                    'no overlap (scored with penalty)',
                );
            }

            $eligible->push($driver);
        }

        $removedCounts = array_map('count', $removed);

        return [
            'total' => $allDrivers->count(),
            'eligible_count' => $eligible->count(),
            'removed_counts' => $removedCounts,
            'removed' => $removed,
            'soft_scoring' => $softScoring,
            'soft_scoring_counts' => array_map('count', $softScoring),
            'eligible' => $eligible,
        ];
    }

    /** @return array<string, mixed> */
    private function analyzeVehicles(
        JobOrder $jobOrder,
        $allVehicles,
        ?string $requiredTypeNormalized,
        ?float $requiredVolume,
    ): array {
        $removed = [
            'admin_locked'          => [],
            'active_assignment'     => [],
            'capacity_insufficient' => [],
        ];

        $softScoring = [
            'schedule_conflict'     => [],
            'vehicle_type_mismatch' => [],
        ];

        $eligible = collect();

        foreach ($allVehicles as $vehicle) {
            $label = $vehicle->plate_no ?: ('Vehicle #'.$vehicle->id);

            if (in_array($vehicle->status, ['maintenance', 'unavailable', 'inactive', 'archived'], true)) {
                $removed['admin_locked'][] = $this->removal($label, $vehicle, 'status', $vehicle->status, 'active/available');
                continue;
            }

            if ($this->vehicleAvailability->hasActiveAssignments($vehicle)) {
                $blocking = DispatchAssignment::query()
                    ->where('vehicle_id', $vehicle->id)
                    ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
                    ->get(['id', 'status', 'job_order_id', 'completed_at']);

                $removed['active_assignment'][] = array_merge(
                    $this->removal($label, $vehicle, 'active_assignments', $blocking->count(), '0'),
                    ['blocking_assignments' => $blocking->map(fn ($a) => [
                        'assignment_id' => $a->id,
                        'status' => $a->status,
                        'job_order_id' => $a->job_order_id,
                        'completed_at' => $a->completed_at,
                    ])->values()->all()],
                );
                continue;
            }

            if (! $this->vehicleMeetsCapacity($vehicle, $requiredVolume)) {
                $capacityReport = VehicleVolumeResolver::meetsRequired($vehicle, $requiredVolume);
                $removed['capacity_insufficient'][] = array_merge(
                    $this->removal(
                        $label,
                        $vehicle,
                        'capacity_m3',
                        $capacityReport['resolved']['value_m3'],
                        '>= '.$requiredVolume.' m³',
                    ),
                    [
                        'comparison'     => $capacityReport['comparison'],
                        'actual_sources' => $capacityReport['resolved']['candidates'],
                        'primary_source' => $capacityReport['resolved']['primary_source'],
                        'required_m3'    => $requiredVolume,
                    ],
                );
                continue;
            }

            if (AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder)) {
                $softScoring['schedule_conflict'][] = $this->removal(
                    $label,
                    $vehicle,
                    'schedule_overlap',
                    'conflicts with active assignment window',
                    'no overlap (scored with penalty)',
                );
            }

            if (! $this->vehicleMatchesRequiredType($vehicle, $requiredTypeNormalized, $jobOrder)) {
                $typeReport = VehicleTypeMatcher::evaluate($vehicle, $jobOrder);
                $softScoring['vehicle_type_mismatch'][] = array_merge(
                    $this->removal(
                        $label,
                        $vehicle,
                        'vehicle_type',
                        $typeReport['vehicle']['vehicle_type_name'] ?? $vehicle->type,
                        implode(' | ', $typeReport['required']['normalized_aliases']),
                    ),
                    [
                        'comparison'        => $typeReport['comparison'],
                        'vehicle_aliases'   => $typeReport['vehicle']['normalized_aliases'],
                        'required_aliases'  => $typeReport['required']['normalized_aliases'],
                        'vehicle_type_id'   => $vehicle->vehicle_type_id,
                        'required_type_id'  => $jobOrder->preferred_vehicle_type_id,
                        'vehicle_wheel_type'=> $typeReport['vehicle']['vehicle_wheel_type'],
                        'required_wheel_type'=> $typeReport['required']['preferred_wheel_type'],
                    ],
                );
            }

            $eligible->push($vehicle);
        }

        return [
            'total' => $allVehicles->count(),
            'eligible_count' => $eligible->count(),
            'removed_counts' => array_map('count', $removed),
            'removed' => $removed,
            'soft_scoring' => $softScoring,
            'soft_scoring_counts' => array_map('count', $softScoring),
            'eligible' => $eligible,
        ];
    }

    /** @param  array<string, mixed>  $extra */
    private function removal(string $name, Driver|Vehicle $entity, string $field, mixed $actual, mixed $expected, array $extra = []): array
    {
        return array_merge([
            'name'       => $name,
            'entity_id'  => $entity->id,
            'field'      => $field,
            'actual'     => $actual,
            'expected'   => $expected,
            'reason'     => "{$name} removed because {$field} = ".json_encode($actual).' (expected '.json_encode($expected).')',
        ], $extra);
    }

    private function detectBottleneck(array $driverStages, array $vehicleStages, int $pairCount): ?string
    {
        if ($pairCount > 0) {
            return null;
        }

        if ($driverStages['eligible_count'] === 0 && $vehicleStages['eligible_count'] === 0) {
            return 'both_drivers_and_vehicles_filtered';
        }
        if ($driverStages['eligible_count'] === 0) {
            return 'all_drivers_filtered';
        }
        if ($vehicleStages['eligible_count'] === 0) {
            return 'all_vehicles_filtered';
        }

        return 'unknown';
    }

    private function bestFitRequiredVolume(JobOrder $jobOrder): ?float
    {
        if ($jobOrder->load_volume_m3 !== null) {
            return (float) $jobOrder->load_volume_m3;
        }

        return $jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null;
    }

    private function normalizeVehicleTypeName(?string $value): ?string
    {
        return VehicleTypeMatcher::normalize($value);
    }

    private function vehicleVolumeCapacity(Vehicle $vehicle): ?float
    {
        return VehicleVolumeResolver::resolve($vehicle)['value_m3'];
    }

    private function vehicleMeetsCapacity(Vehicle $vehicle, ?float $requiredVolume): bool
    {
        return VehicleVolumeResolver::meetsRequired($vehicle, $requiredVolume)['pass'];
    }

    private function vehicleMatchesRequiredType(Vehicle $vehicle, ?string $requiredTypeNormalized, JobOrder $jobOrder): bool
    {
        return VehicleTypeMatcher::evaluate($vehicle, $jobOrder)['matched'];
    }
}
