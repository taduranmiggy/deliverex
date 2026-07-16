<?php

namespace App\Services\Gps;

use App\Models\DispatchAssignment;
use App\Models\JobOrder;
use App\Models\TrackingLog;
use App\Models\User;
use App\Services\Delivery\EtaEstimationService;
use App\Services\Delivery\JobOrderLocationService;
use App\Support\DeliveryStatus;
use App\Support\DriverAccount;

class JobOrderTrackingService
{
    public function __construct(
        private TrackingService $trackingService,
        private DriverLocationService $driverLocationService,
        private JobOrderLocationService $locationService,
        private RouteDirectionsService $directions,
        private EtaEstimationService $etaEstimation,
    ) {
    }

    public function canView(User $user, JobOrder $jobOrder): bool
    {
        $role = $user->role?->name;

        if (in_array($role, ['admin', 'dispatcher', 'manager'], true)) {
            return true;
        }

        if ($role === 'customer') {
            if ($jobOrder->customer_user_id && (int) $jobOrder->customer_user_id === (int) $user->id) {
                return true;
            }

            $companyId = $user->company_id ?? $user->company?->id ?? null;

            return $companyId && (int) $jobOrder->company_id === (int) $companyId;
        }

        if ($role === 'driver') {
            $driver = DriverAccount::resolve($user);

            return $driver && $jobOrder->assignments()->where('driver_id', $driver->id)->exists();
        }

        return false;
    }

    /** @return array<string, mixed> */
    public function payload(JobOrder $jobOrder, bool $customerView = false, bool $includeHistory = false): array
    {
        $jobOrder = $this->locationService->ensureCoordinates($jobOrder);

        $assignment = $jobOrder->assignments()
            ->latest('assigned_at')
            ->with(['driver.user', 'vehicle'])
            ->first();

        $latest = $assignment ? $this->trackingService->latestForAssignment($assignment) : null;
        $current = $assignment ? $this->driverLocationService->currentForAssignment($assignment) : null;

        if ($current && $current->captured_at && (! $latest || $current->captured_at->gt($latest->captured_at))) {
            $latest = $this->trackingLogFromCurrent($current, $assignment);
        }

        $status = DeliveryStatus::canonicalize($assignment?->status ?? $jobOrder->status)
            ?? ($assignment?->status ?? $jobOrder->status);

        $pickup = $this->point($jobOrder->pickup_latitude, $jobOrder->pickup_longitude, $jobOrder->display_pickup ?? '');
        $destination = $this->point($jobOrder->dropoff_latitude, $jobOrder->dropoff_longitude, $jobOrder->display_dropoff ?? '');

        $route = null;
        if ($latest && $destination) {
            $route = $this->directions->route(
                (float) $latest->latitude,
                (float) $latest->longitude,
                (float) $destination['lat'],
                (float) $destination['lng'],
            );
        } elseif ($pickup && $destination) {
            $route = $this->directions->route(
                (float) $pickup['lat'],
                (float) $pickup['lng'],
                (float) $destination['lat'],
                (float) $destination['lng'],
            );
        }

        $eta = $this->etaEstimation->estimate($jobOrder, $latest, (string) $status);

        $location = $customerView
            ? $this->trackingService->formatForCustomer($latest)
            : $this->trackingService->formatForFleet($latest);

        if ($location && $customerView) {
            unset($location['accuracy_m'], $location['heading'], $location['speed_kmh']);
        }

        $payload = [
            'job_order_id' => $jobOrder->id,
            'tracking_code' => $jobOrder->tracking_code,
            'status' => $status,
            'assignment' => $assignment ? [
                'id' => $assignment->id,
                'status' => $assignment->status,
            ] : null,
            'driver' => $customerView ? null : ($assignment?->driver?->user?->name),
            'vehicle' => $customerView ? null : ($assignment?->vehicle?->plate_no),
            'location' => $location,
            'pickup' => $pickup,
            'destination' => $destination,
            'route' => $route,
            'eta' => $eta,
            'last_updated' => $location['at'] ?? null,
            'offline' => $this->trackingService->offlineStatus($latest),
        ];

        if ($includeHistory && $assignment) {
            $payload['trip_history'] = $this->driverLocationService->tripHistoryForAssignment($assignment);
        }

        return $payload;
    }

    /** @return array<string, mixed>|null */
    private function point(mixed $lat, mixed $lng, string $address): ?array
    {
        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return $address !== '' ? ['address' => $address] : null;
        }

        return [
            'lat' => (float) $lat,
            'lng' => (float) $lng,
            'address' => $address,
        ];
    }

    private function trackingLogFromCurrent($current, DispatchAssignment $assignment): TrackingLog
    {
        $log = new TrackingLog([
            'assignment_id' => $assignment->id,
            'driver_id' => $assignment->driver_id,
            'latitude' => $current->latitude,
            'longitude' => $current->longitude,
            'accuracy_m' => $current->accuracy_m,
            'heading' => $current->heading,
            'speed_kmh' => $current->speed_kmh,
            'captured_at' => $current->captured_at,
        ]);
        $log->exists = true;

        return $log;
    }
}
