<?php

namespace App\Services\Gps;

use App\Events\DriverLocationUpdated;
use App\Models\DispatchAssignment;
use App\Models\TrackingLog;
use App\Support\DeliveryStatus;
use App\Support\GpsCoordinateValidator;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class TrackingService
{
    public function __construct(private DriverLocationService $driverLocationService)
    {
    }

    public function latestForAssignment(DispatchAssignment $assignment): ?TrackingLog
    {
        return $assignment->trackingLogs()->latest('captured_at')->first();
    }

    /**
     * @param  array{
     *   latitude: float|int|string,
     *   longitude: float|int|string,
     *   captured_at?: \DateTimeInterface|string|null,
     *   accuracy_m?: float|int|null,
     *   heading?: float|int|null,
     *   speed_kmh?: float|int|null,
     *   source?: string|null,
     *   synced_at?: \DateTimeInterface|string|null,
     *   battery_level?: int|null,
     *   force?: bool
     * }  $payload
     * @return array{log: ?TrackingLog, skipped: bool, reason: ?string}
     */
    public function record(DispatchAssignment $assignment, array $payload, ?int $driverId = null): array
    {
        $lat = (float) $payload['latitude'];
        $lng = (float) $payload['longitude'];

        if ($error = GpsCoordinateValidator::validate($lat, $lng)) {
            return ['log' => null, 'skipped' => true, 'reason' => $error];
        }

        if ($error = $this->canAcceptTracking($assignment, $driverId)) {
            return ['log' => null, 'skipped' => true, 'reason' => $error];
        }

        $capturedAt = isset($payload['captured_at'])
            ? Carbon::parse($payload['captured_at'])
            : now();

        $lastLog = $this->latestForAssignment($assignment);
        $force = (bool) ($payload['force'] ?? false);

        if (! $force) {
            if ($reason = $this->rejectImpossibleJump($lastLog, $lat, $lng, $capturedAt)) {
                Log::info('GPS jump rejected', [
                    'assignment_id' => $assignment->id,
                    'reason' => $reason,
                ]);

                return ['log' => null, 'skipped' => true, 'reason' => $reason];
            }

            if ($this->isDuplicate($lastLog, $lat, $lng, $capturedAt)) {
                return ['log' => $lastLog, 'skipped' => true, 'reason' => 'duplicate_coordinate'];
            }

            if ($this->isInsignificantMovement($lastLog, $lat, $lng, $capturedAt)) {
                return ['log' => $lastLog, 'skipped' => true, 'reason' => 'insignificant_movement'];
            }
        }

        $batteryLevel = isset($payload['battery_level']) ? (int) $payload['battery_level'] : null;

        $log = TrackingLog::create([
            'assignment_id' => $assignment->id,
            'driver_id' => $driverId ?? $assignment->driver_id,
            'latitude' => $lat,
            'longitude' => $lng,
            'accuracy_m' => isset($payload['accuracy_m']) ? (float) $payload['accuracy_m'] : null,
            'heading' => isset($payload['heading']) ? (float) $payload['heading'] : null,
            'speed_kmh' => $this->normalizeSpeed($payload['speed_kmh'] ?? null),
            'battery_level' => $batteryLevel,
            'source' => $payload['source'] ?? 'driver_ping',
            'captured_at' => $capturedAt,
            'synced_at' => isset($payload['synced_at']) ? Carbon::parse($payload['synced_at']) : null,
        ]);

        $this->driverLocationService->syncFromTrackingLog($log, $batteryLevel);

        $this->broadcastLocationUpdate($log, $assignment);

        return ['log' => $log, 'skipped' => false, 'reason' => null];
    }

    /**
     * Push the new position to WebSocket subscribers immediately.
     * Broadcast failure must never reject the GPS ingest itself.
     */
    private function broadcastLocationUpdate(TrackingLog $log, DispatchAssignment $assignment): void
    {
        try {
            broadcast(new DriverLocationUpdated(
                $log,
                $assignment->job_order_id,
                $this->formatForFleet($log),
            ));
        } catch (\Throwable $e) {
            Log::warning('Driver location broadcast failed', [
                'assignment_id' => $assignment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function canAcceptTracking(DispatchAssignment $assignment, ?int $driverId): ?string
    {
        if ($driverId !== null && (int) $assignment->driver_id !== (int) $driverId) {
            return 'Driver is not assigned to this job.';
        }

        $status = DeliveryStatus::canonicalize($assignment->status) ?? $assignment->status;

        if (DeliveryStatus::isTerminal($status)) {
            return 'GPS updates are not allowed for completed or cancelled deliveries.';
        }

        if (! $this->isGpsActiveStatus($status)) {
            return 'GPS updates are not allowed for the current delivery stage.';
        }

        return null;
    }

    public function isGpsActiveStatus(string $status): bool
    {
        $canonical = DeliveryStatus::canonicalize($status) ?? $status;

        return in_array($canonical, [
            DeliveryStatus::ASSIGNED,
            DeliveryStatus::EN_ROUTE_TO_PICKUP,
            DeliveryStatus::ARRIVED_AT_PICKUP,
            DeliveryStatus::EN_ROUTE_TO_DESTINATION,
            DeliveryStatus::ARRIVED_AT_DESTINATION,
        ], true);
    }

    /** @return list<array{lat:float,lng:float,at:?string,speed_kmh:?float}> */
    public function historyForAssignment(DispatchAssignment $assignment, int $limit = 200): array
    {
        return $assignment->trackingLogs()
            ->orderBy('captured_at')
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn ($log) => [
                'lat' => (float) $log->latitude,
                'lng' => (float) $log->longitude,
                'at' => $log->captured_at?->toIso8601String(),
                'speed_kmh' => $log->speed_kmh,
            ])
            ->all();
    }

    public function rejectImpossibleJump(?TrackingLog $last, float $lat, float $lng, Carbon $at): ?string
    {
        if (! $last || ! $last->captured_at) {
            return null;
        }

        $distance = GpsCoordinateValidator::distanceMeters(
            (float) $last->latitude,
            (float) $last->longitude,
            $lat,
            $lng,
        );

        $elapsed = max(1, abs($at->diffInSeconds($last->captured_at)));
        $speed = GpsCoordinateValidator::impliedSpeedKmh($distance, $elapsed);
        $maxSpeed = (float) config('gps.max_speed_kmh', 180);

        if ($speed > $maxSpeed) {
            return sprintf('Impossible GPS movement detected (%.0f km/h).', $speed);
        }

        return null;
    }

    public function isDuplicate(?TrackingLog $last, float $lat, float $lng, Carbon $at): bool
    {
        if (! $last || ! $last->captured_at) {
            return false;
        }

        $window = (int) config('gps.duplicate_window_seconds', 12);
        if (abs($at->diffInSeconds($last->captured_at)) > $window) {
            return false;
        }

        $radius = (float) config('gps.duplicate_radius_meters', 5);
        $distance = GpsCoordinateValidator::distanceMeters(
            (float) $last->latitude,
            (float) $last->longitude,
            $lat,
            $lng,
        );

        return $distance <= $radius;
    }

    public function isInsignificantMovement(?TrackingLog $last, float $lat, float $lng, ?Carbon $at = null): bool
    {
        if (! $last) {
            return false;
        }

        // Heartbeat: keep last-seen fresh for realtime maps even when parked.
        $at ??= now();
        if ($last->captured_at) {
            $heartbeat = (int) config('gps.heartbeat_seconds', 12);
            if (abs($at->diffInSeconds($last->captured_at)) >= $heartbeat) {
                return false;
            }
        }

        $minMovement = (float) config('gps.min_movement_meters', 5);
        $distance = GpsCoordinateValidator::distanceMeters(
            (float) $last->latitude,
            (float) $last->longitude,
            $lat,
            $lng,
        );

        return $distance < $minMovement;
    }

    /** @return array<string, mixed> */
    public function offlineStatus(?TrackingLog $log): array
    {
        if (! $log || ! $log->captured_at) {
            return [
                'state' => 'unknown',
                'label' => null,
                'age_seconds' => null,
            ];
        }

        $ageSeconds = max(0, $log->captured_at->diffInSeconds(now()));
        $offlineAfter = (int) config('gps.offline_after_seconds', 120);
        $lostAfter = (int) config('gps.gps_lost_after_seconds', 300);

        if ($ageSeconds >= $lostAfter) {
            return [
                'state' => 'gps_lost',
                'label' => 'GPS signal lost.',
                'age_seconds' => $ageSeconds,
            ];
        }

        if ($ageSeconds >= $offlineAfter) {
            return [
                'state' => 'temporarily_offline',
                'label' => 'Driver temporarily offline.',
                'age_seconds' => $ageSeconds,
            ];
        }

        return [
            'state' => 'online',
            'label' => null,
            'age_seconds' => $ageSeconds,
        ];
    }

    /** @return array<string, mixed>|null */
    public function formatForCustomer(?TrackingLog $log): ?array
    {
        if (! $log) {
            return null;
        }

        $offline = $this->offlineStatus($log);

        return [
            'lat' => round((float) $log->latitude, 2),
            'lng' => round((float) $log->longitude, 2),
            'at' => $log->captured_at?->toIso8601String(),
            'is_stale' => in_array($offline['state'], ['temporarily_offline', 'gps_lost'], true),
            'offline' => $offline,
        ];
    }

    /** @return array<string, mixed>|null */
    public function formatForFleet(?TrackingLog $log): ?array
    {
        if (! $log) {
            return null;
        }

        $offline = $this->offlineStatus($log);

        return [
            'lat' => (float) $log->latitude,
            'lng' => (float) $log->longitude,
            'at' => $log->captured_at?->toIso8601String(),
            'accuracy_m' => $log->accuracy_m,
            'heading' => $log->heading,
            'speed_kmh' => $log->speed_kmh,
            'battery_level' => $log->battery_level,
            'is_stale' => in_array($offline['state'], ['temporarily_offline', 'gps_lost'], true),
            'is_critical_stale' => $offline['state'] === 'gps_lost',
            'offline' => $offline,
            'performed_offline' => $log->synced_at !== null,
            'synced_at' => $log->synced_at?->toIso8601String(),
        ];
    }

    private function normalizeSpeed(mixed $speed): ?float
    {
        if (! is_numeric($speed)) {
            return null;
        }

        $value = (float) $speed;

        // Browser geolocation speed is m/s; convert when value looks like m/s.
        if ($value >= 0 && $value < 80) {
            return round($value * 3.6, 3);
        }

        return round($value, 3);
    }
}
