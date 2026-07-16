<?php

namespace App\Services\Fleet;

use App\Models\DispatchAssignment;
use App\Models\Vehicle;
use App\Support\DeliveryStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;

class VehicleAvailabilityService
{
    private const ADMIN_LOCKED = ['maintenance', 'unavailable', 'inactive'];

    public function isAssignable(Vehicle $vehicle): bool
    {
        if ($this->isAdminLocked($vehicle)) {
            return false;
        }

        return ! $this->hasActiveAssignments($vehicle);
    }

    public function isAdminLocked(Vehicle $vehicle): bool
    {
        return in_array($vehicle->status, self::ADMIN_LOCKED, true);
    }

    public function hasActiveAssignments(Vehicle|int $vehicle): bool
    {
        $vehicleId = $vehicle instanceof Vehicle ? $vehicle->id : $vehicle;

        return $this->activeAssignmentsQuery($vehicleId)->exists();
    }

    public function activeAssignmentsQuery(int $vehicleId): Builder
    {
        return DispatchAssignment::query()
            ->where('vehicle_id', $vehicleId)
            ->whereIn('status', DeliveryStatus::availabilityBlockingRawValues());
    }

    public function primaryActiveAssignment(Vehicle|int $vehicle): ?DispatchAssignment
    {
        $vehicleId = $vehicle instanceof Vehicle ? $vehicle->id : $vehicle;

        $inProgressStatuses = array_values(array_diff(
            DeliveryStatus::availabilityBlockingRawValues(),
            ['assigned', 'dispatched', 'pending'],
        ));

        $inProgress = DispatchAssignment::query()
            ->where('vehicle_id', $vehicleId)
            ->whereIn('status', $inProgressStatuses)
            ->orderByDesc('started_at')
            ->orderByDesc('assigned_at')
            ->orderByDesc('id')
            ->first();

        if ($inProgress) {
            return $inProgress;
        }

        return DispatchAssignment::query()
            ->where('vehicle_id', $vehicleId)
            ->whereIn('status', ['assigned', 'dispatched', 'pending'])
            ->orderByDesc('assigned_at')
            ->orderByDesc('id')
            ->first();
    }

    public function deriveStatus(Vehicle $vehicle): string
    {
        $primary = $this->primaryActiveAssignment($vehicle);

        if ($primary) {
            return DeliveryStatus::toVehicleStatus($primary->status);
        }

        if ($this->isAdminLocked($vehicle)) {
            return $vehicle->status;
        }

        return 'available';
    }

    /**
     * @return array{vehicle_id:int,previous:string,new:string,reason:string,assignment_id:?int}|null
     */
    public function sync(Vehicle|int $vehicle, string $reason, ?int $triggeredByUserId = null): ?array
    {
        $model = $vehicle instanceof Vehicle
            ? $vehicle
            : Vehicle::query()->findOrFail($vehicle);

        $previous = $model->status ?? 'available';
        $derived = $this->deriveStatus($model);
        $primaryAssignment = $this->primaryActiveAssignment($model);

        if ($previous === $derived) {
            return null;
        }

        $model->update(['status' => $derived]);

        $change = [
            'vehicle_id'    => $model->id,
            'previous'      => $previous,
            'new'           => $derived,
            'reason'        => $reason,
            'assignment_id' => $primaryAssignment?->id,
        ];

        Log::info('Vehicle status synchronized', array_merge($change, [
            'triggered_by_user_id' => $triggeredByUserId,
        ]));

        return $change;
    }

    public function syncForAssignment(DispatchAssignment $assignment, string $reason, ?int $triggeredByUserId = null): void
    {
        if ($assignment->vehicle_id) {
            $this->sync($assignment->vehicle_id, $reason, $triggeredByUserId);
        }
    }

    public function reconcileAll(string $reason = 'database_cleanup'): int
    {
        $changes = 0;

        Vehicle::query()->each(function (Vehicle $vehicle) use (&$changes, $reason) {
            if ($this->sync($vehicle, $reason) !== null) {
                $changes++;
            }
        });

        return $changes;
    }
}
