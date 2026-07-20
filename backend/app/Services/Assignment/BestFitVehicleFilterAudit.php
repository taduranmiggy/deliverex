<?php

namespace App\Services\Assignment;

use App\Models\DispatchAssignment;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Fleet\VehicleAvailabilityService;
use App\Support\AssignmentScheduleConflict;
use App\Support\DeliveryStatus;
use App\Support\VehicleTypeMatcher;
use App\Support\VehicleVolumeResolver;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class BestFitVehicleFilterAudit
{
    public function __construct(
        private VehicleAvailabilityService $vehicleAvailability,
    ) {
    }

    /**
     * @return array{
     *     vehicles: list<array<string, mixed>>,
     *     summary: array<string, int>
     * }
     */
    public function audit(JobOrder $jobOrder, ?Collection $vehicles = null): array
    {
        $jobOrder->loadMissing('preferredVehicleType');

        $requiredVolume = $this->requiredVolume($jobOrder);
        $vehicles ??= Vehicle::query()->with('vehicleType')->orderBy('plate_no')->get();

        $entries = [];
        $summary = [
            'total'                 => $vehicles->count(),
            'eligible'              => 0,
            'hard_rejected'         => 0,
            'admin_locked'          => 0,
            'active_assignment'     => 0,
            'capacity_insufficient' => 0,
            'vehicle_type_mismatch' => 0,
            'schedule_conflict'     => 0,
        ];

        foreach ($vehicles as $vehicle) {
            $entry = $this->auditVehicle($vehicle, $jobOrder, $requiredVolume);
            $entries[] = $entry;

            if ($entry['final'] === 'ELIGIBLE') {
                $summary['eligible']++;
                foreach ($entry['soft_flags'] as $flag) {
                    if (isset($summary[$flag])) {
                        $summary[$flag]++;
                    }
                }
            } else {
                $summary['hard_rejected']++;
                if ($entry['hard_rejection'] !== null && isset($summary[$entry['hard_rejection']])) {
                    $summary[$entry['hard_rejection']]++;
                }
            }

            Log::info('BestFit vehicle filter audit', [
                'job_order_id' => $jobOrder->id,
                'vehicle_id'   => $vehicle->id,
                'plate_no'     => $entry['plate_no'],
                'final'        => $entry['final'],
                'hard_rejection' => $entry['hard_rejection'],
                'soft_flags'   => $entry['soft_flags'],
                'checks'       => $entry['checks'],
            ]);
        }

        return [
            'vehicles' => $entries,
            'summary'  => $summary,
        ];
    }

    /** @return array<string, mixed> */
    private function auditVehicle(Vehicle $vehicle, JobOrder $jobOrder, ?float $requiredVolume): array
    {
        $label = $vehicle->plate_no ?: ('Vehicle #'.$vehicle->id);
        $checks = [];
        $softFlags = [];
        $hardRejection = null;

        $statusPass = ! in_array($vehicle->status, ['maintenance', 'unavailable', 'inactive', 'archived'], true);
        $checks[] = [
            'step'     => 'status',
            'label'    => 'Maintenance / availability status',
            'actual'   => $vehicle->status ?? 'null',
            'expected' => 'available (not maintenance/unavailable/inactive/archived)',
            'pass'     => $statusPass,
            'hard_block' => true,
        ];

        if (! $statusPass) {
            $hardRejection = 'admin_locked';
        }

        $capacityReport = VehicleVolumeResolver::meetsRequired($vehicle, $requiredVolume);
        $checks[] = [
            'step'           => 'capacity',
            'label'          => 'Capacity (m³)',
            'actual'         => $capacityReport['resolved']['value_m3'],
            'actual_sources' => $capacityReport['resolved']['candidates'],
            'primary_source' => $capacityReport['resolved']['primary_source'],
            'required'       => $requiredVolume,
            'comparison'     => $capacityReport['comparison'],
            'pass'           => $capacityReport['pass'],
            'hard_block'     => true,
            'detail'         => $capacityReport['detail'],
        ];

        if ($hardRejection === null && ! $capacityReport['pass']) {
            $hardRejection = 'capacity_insufficient';
        }

        $typeReport = VehicleTypeMatcher::evaluate($vehicle, $jobOrder);
        $checks[] = [
            'step'       => 'type',
            'label'      => 'Vehicle type',
            'actual'     => $typeReport['vehicle'],
            'required'   => $typeReport['required'],
            'comparison' => $typeReport['comparison'],
            'pass'       => $typeReport['matched'],
            'hard_block' => false,
            'match_method' => $typeReport['match_method'],
        ];

        if (! $typeReport['matched']) {
            $softFlags[] = 'vehicle_type_mismatch';
        }

        $availabilityPass = ! $this->vehicleAvailability->isAdminLocked($vehicle);
        $checks[] = [
            'step'     => 'availability',
            'label'    => 'Availability flag',
            'actual'   => $vehicle->status ?? 'null',
            'expected' => 'not admin-locked',
            'pass'     => $availabilityPass,
            'hard_block' => false,
        ];

        $blocking = DispatchAssignment::query()
            ->where('vehicle_id', $vehicle->id)
            ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues())
            ->get(['id', 'status', 'job_order_id', 'assigned_at', 'completed_at']);

        $assignmentPass = $blocking->isEmpty();
        $checks[] = [
            'step'       => 'assignment',
            'label'      => 'Active assignment',
            'actual'     => $blocking->map(fn ($row) => [
                'assignment_id' => $row->id,
                'status'        => $row->status,
                'job_order_id'  => $row->job_order_id,
                'assigned_at'   => $row->assigned_at,
                'completed_at'  => $row->completed_at,
            ])->values()->all(),
            'expected'   => 'none',
            'comparison' => $assignmentPass ? 'PASS no blocking assignments' : 'FAIL '.$blocking->count().' blocking assignment(s)',
            'pass'       => $assignmentPass,
            'hard_block' => true,
        ];

        if ($hardRejection === null && ! $assignmentPass) {
            $hardRejection = 'active_assignment';
        }

        $scheduleConflict = AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder);
        $checks[] = [
            'step'       => 'schedule',
            'label'      => 'Schedule overlap',
            'actual'     => $scheduleConflict ? 'overlap detected' : 'none',
            'expected'   => 'no overlap (soft scoring penalty if overlap)',
            'comparison' => $scheduleConflict ? 'WARN schedule window may overlap' : 'PASS no schedule overlap',
            'pass'       => ! $scheduleConflict,
            'hard_block' => false,
        ];

        if ($scheduleConflict) {
            $softFlags[] = 'schedule_conflict';
        }

        $final = $hardRejection === null ? 'ELIGIBLE' : 'REJECTED';

        return [
            'vehicle_id'     => $vehicle->id,
            'plate_no'       => $label,
            'checks'         => $checks,
            'soft_flags'     => $softFlags,
            'hard_rejection' => $hardRejection,
            'final'          => $final,
            'eligible'       => $final === 'ELIGIBLE',
        ];
    }

    private function requiredVolume(JobOrder $jobOrder): ?float
    {
        if ($jobOrder->load_volume_m3 !== null) {
            return (float) $jobOrder->load_volume_m3;
        }

        return $jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null;
    }
}
