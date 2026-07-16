<?php

namespace App\Services\Fleet;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Services\Driver\DriverAvailabilityService;
use App\Support\DeliveryStatus;

class ResourceConsistencyService
{
    public function __construct(
        private DriverAvailabilityService $driverAvailability,
        private VehicleAvailabilityService $vehicleAvailability,
    ) {
    }

    /**
     * @return array{
     *   checked_at: string,
     *   issue_count: int,
     *   issues: list<array{type: string, severity: string, message: string, entity_type: string, entity_id: int, details: array<string, mixed>}>
     * }
     */
    public function report(): array
    {
        $issues = [];

        $issues = array_merge($issues, $this->checkDriverAvailabilityDrift());
        $issues = array_merge($issues, $this->checkVehicleStatusDrift());
        $issues = array_merge($issues, $this->checkDuplicateActiveAssignments());
        $issues = array_merge($issues, $this->checkStaleDriverPointers());
        $issues = array_merge($issues, $this->checkBrokenAssignmentReferences());

        return [
            'checked_at'  => now()->toIso8601String(),
            'issue_count' => count($issues),
            'issues'      => $issues,
        ];
    }

    private function checkDriverAvailabilityDrift(): array
    {
        $issues = [];

        Driver::query()->each(function (Driver $driver) use (&$issues) {
            $derived = $this->driverAvailability->deriveAvailability($driver);
            $stored = $driver->availability ?? 'available';
            $activeCount = $this->driverAvailability->activeAssignmentCount($driver);

            if ($stored !== $derived) {
                $issues[] = $this->issue(
                    'driver_availability_drift',
                    'error',
                    "Driver #{$driver->id} stored availability '{$stored}' does not match derived '{$derived}'.",
                    'driver',
                    $driver->id,
                    [
                        'stored'               => $stored,
                        'derived'              => $derived,
                        'active_assignments'   => $activeCount,
                        'current_assignment_id'=> $driver->current_assignment_id,
                    ],
                );
            }

            if ($stored === 'available' && $activeCount > 0) {
                $issues[] = $this->issue(
                    'driver_available_with_active_job',
                    'critical',
                    "Driver #{$driver->id} is marked available but has {$activeCount} active assignment(s).",
                    'driver',
                    $driver->id,
                    ['active_assignments' => $activeCount],
                );
            }

            if (in_array($stored, ['busy', 'assigned'], true) && $activeCount === 0 && $driver->status !== 'inactive') {
                $issues[] = $this->issue(
                    'driver_busy_without_assignment',
                    'error',
                    "Driver #{$driver->id} is marked '{$stored}' but has no active assignment.",
                    'driver',
                    $driver->id,
                    ['stored' => $stored],
                );
            }
        });

        return $issues;
    }

    private function checkVehicleStatusDrift(): array
    {
        $issues = [];

        Vehicle::query()->each(function (Vehicle $vehicle) use (&$issues) {
            $derived = $this->vehicleAvailability->deriveStatus($vehicle);
            $stored = $vehicle->status ?? 'available';
            $hasActive = $this->vehicleAvailability->hasActiveAssignments($vehicle);

            if ($stored !== $derived) {
                $issues[] = $this->issue(
                    'vehicle_status_drift',
                    'error',
                    "Vehicle #{$vehicle->id} ({$vehicle->plate_no}) stored status '{$stored}' does not match derived '{$derived}'.",
                    'vehicle',
                    $vehicle->id,
                    ['stored' => $stored, 'derived' => $derived, 'has_active_assignment' => $hasActive],
                );
            }

            if ($stored === 'available' && $hasActive) {
                $issues[] = $this->issue(
                    'vehicle_available_with_active_job',
                    'critical',
                    "Vehicle #{$vehicle->id} ({$vehicle->plate_no}) is available but has an active assignment.",
                    'vehicle',
                    $vehicle->id,
                    [],
                );
            }

            if (in_array($stored, DeliveryStatus::vehicleInOperationStatuses(), true) && ! $hasActive) {
                $issues[] = $this->issue(
                    'vehicle_busy_without_assignment',
                    'error',
                    "Vehicle #{$vehicle->id} ({$vehicle->plate_no}) is '{$stored}' but has no active assignment.",
                    'vehicle',
                    $vehicle->id,
                    ['stored' => $stored],
                );
            }
        });

        return $issues;
    }

    private function checkDuplicateActiveAssignments(): array
    {
        $issues = [];

        foreach (['driver_id', 'vehicle_id', 'job_order_id'] as $column) {
            $duplicates = DispatchAssignment::query()
                ->select($column)
                ->selectRaw('COUNT(*) as active_count')
                ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
                ->groupBy($column)
                ->havingRaw('COUNT(*) > 1')
                ->get();

            foreach ($duplicates as $row) {
                $issues[] = $this->issue(
                    'duplicate_active_assignments',
                    'critical',
                    "Multiple active assignments detected for {$column}={$row->{$column}}.",
                    'dispatch_assignment',
                    (int) $row->{$column},
                    ['column' => $column, 'active_count' => (int) $row->active_count],
                );
            }
        }

        return $issues;
    }

    private function checkStaleDriverPointers(): array
    {
        $issues = [];

        Driver::query()
            ->whereNotNull('current_assignment_id')
            ->each(function (Driver $driver) use (&$issues) {
                $assignment = DispatchAssignment::query()->find($driver->current_assignment_id);

                if (! $assignment) {
                    $issues[] = $this->issue(
                        'orphan_current_assignment_pointer',
                        'error',
                        "Driver #{$driver->id} current_assignment_id points to missing assignment #{$driver->current_assignment_id}.",
                        'driver',
                        $driver->id,
                        ['current_assignment_id' => $driver->current_assignment_id],
                    );

                    return;
                }

                if ($assignment->driver_id !== $driver->id) {
                    $issues[] = $this->issue(
                        'mismatched_current_assignment_pointer',
                        'error',
                        "Driver #{$driver->id} current_assignment_id belongs to another driver.",
                        'driver',
                        $driver->id,
                        [
                            'current_assignment_id' => $driver->current_assignment_id,
                            'assignment_driver_id'  => $assignment->driver_id,
                        ],
                    );
                }

                if (DeliveryStatus::isTerminal($assignment->status)) {
                    $issues[] = $this->issue(
                        'stale_current_assignment_pointer',
                        'error',
                        "Driver #{$driver->id} current_assignment_id references terminal assignment #{$assignment->id}.",
                        'driver',
                        $driver->id,
                        ['assignment_status' => $assignment->status],
                    );
                }
            });

        return $issues;
    }

    private function checkBrokenAssignmentReferences(): array
    {
        $issues = [];

        DispatchAssignment::query()
            ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
            ->with(['driver:id', 'vehicle:id,plate_no'])
            ->each(function (DispatchAssignment $assignment) use (&$issues) {
                if (! $assignment->driver) {
                    $issues[] = $this->issue(
                        'orphan_assignment_driver',
                        'critical',
                        "Active assignment #{$assignment->id} references missing driver #{$assignment->driver_id}.",
                        'dispatch_assignment',
                        $assignment->id,
                        ['driver_id' => $assignment->driver_id],
                    );
                }

                if (! $assignment->vehicle) {
                    $issues[] = $this->issue(
                        'orphan_assignment_vehicle',
                        'critical',
                        "Active assignment #{$assignment->id} references missing vehicle #{$assignment->vehicle_id}.",
                        'dispatch_assignment',
                        $assignment->id,
                        ['vehicle_id' => $assignment->vehicle_id],
                    );
                }
            });

        return $issues;
    }

    /**
     * @param  array<string, mixed>  $details
     * @return array{type: string, severity: string, message: string, entity_type: string, entity_id: int, details: array<string, mixed>}
     */
    private function issue(
        string $type,
        string $severity,
        string $message,
        string $entityType,
        int $entityId,
        array $details,
    ): array {
        return [
            'type'        => $type,
            'severity'    => $severity,
            'message'     => $message,
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'details'     => $details,
        ];
    }
}
