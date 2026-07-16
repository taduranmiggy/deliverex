<?php

namespace App\Services\Gps;

use App\Models\DispatchAssignment;
use App\Models\DriverCurrentLocation;
use App\Models\DriverLocationHistory;
use App\Models\TrackingLog;
use App\Support\DeliveryStatus;

class DriverLocationService
{
    /**
     * Mirror a tracking log row into driver location history + current snapshot.
     */
    public function syncFromTrackingLog(TrackingLog $log, ?int $batteryLevel = null): void
    {
        $driverId = $log->driver_id ?? $log->assignment?->driver_id;
        if (! $driverId) {
            $log->loadMissing('assignment');
            $driverId = $log->driver_id ?? $log->assignment?->driver_id;
        }
        if (! $driverId) {
            return;
        }

        $log->loadMissing('assignment');
        $assignment = $log->assignment;
        $jobOrderId = $assignment?->job_order_id;
        $capturedAt = $log->captured_at ?? now();
        $battery = $batteryLevel ?? $log->battery_level;

        DriverLocationHistory::create([
            'driver_id' => $driverId,
            'assignment_id' => $log->assignment_id,
            'job_order_id' => $jobOrderId,
            'latitude' => $log->latitude,
            'longitude' => $log->longitude,
            'speed_kmh' => $log->speed_kmh,
            'heading' => $log->heading,
            'accuracy_m' => $log->accuracy_m,
            'battery_level' => $battery,
            'captured_at' => $capturedAt,
        ]);

        DriverCurrentLocation::updateOrCreate(
            ['driver_id' => $driverId],
            [
                'assignment_id' => $log->assignment_id,
                'job_order_id' => $jobOrderId,
                'latitude' => $log->latitude,
                'longitude' => $log->longitude,
                'speed_kmh' => $log->speed_kmh,
                'heading' => $log->heading,
                'accuracy_m' => $log->accuracy_m,
                'battery_level' => $battery,
                'captured_at' => $capturedAt,
            ],
        );
    }

    public function currentForAssignment(DispatchAssignment $assignment): ?DriverCurrentLocation
    {
        if (! $assignment->driver_id) {
            return null;
        }

        return DriverCurrentLocation::query()
            ->where('driver_id', $assignment->driver_id)
            ->where('assignment_id', $assignment->id)
            ->first();
    }

    /** @return list<array<string, mixed>> */
    public function tripHistoryForAssignment(DispatchAssignment $assignment, int $limit = 500): array
    {
        return DriverLocationHistory::query()
            ->where('assignment_id', $assignment->id)
            ->orderBy('captured_at')
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn (DriverLocationHistory $row) => [
                'lat' => (float) $row->latitude,
                'lng' => (float) $row->longitude,
                'at' => $row->captured_at?->toIso8601String(),
                'speed_kmh' => $row->speed_kmh,
                'heading' => $row->heading,
                'status' => DeliveryStatus::canonicalize((string) $assignment->status) ?? $assignment->status,
            ])
            ->all();
    }
}
