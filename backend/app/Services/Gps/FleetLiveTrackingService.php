<?php

namespace App\Services\Gps;

use App\Models\DispatchAssignment;
use App\Models\TrackingLog;
use App\Services\Delivery\JobOrderLocationService;
use App\Support\DeliveryStatus;
use App\Support\GpsCoordinateValidator;
use App\Support\LocationPipelineLogger;

class FleetLiveTrackingService
{
    public function __construct(
        private TrackingService $trackingService,
        private JobOrderLocationService $locationService,
        private RouteDirectionsService $directions,
        private DriverLocationService $driverLocationService,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function activeDeliveries(): array
    {
        $terminal = [
            DeliveryStatus::COMPLETED,
            DeliveryStatus::CANCELLED,
            'completed',
            'cancelled',
        ];

        return DispatchAssignment::query()
            ->whereNotIn('status', $terminal)
            ->with([
                'jobOrder',
                'driver.user',
                'vehicle.vehicleType',
                'latestDelayReport',
                'latestArrivedStatusLog',
                'latestTrackingLog',
                'deliveryDocuments' => fn ($q) => $q->where('type', 'departure'),
            ])
            ->latest('updated_at')
            ->get()
            ->map(fn (DispatchAssignment $assignment) => $this->formatDelivery($assignment))
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    public function formatDelivery(DispatchAssignment $assignment): array
    {
        $latest = $this->resolveLatestTrackingLog($assignment);
        $location = $this->trackingService->formatForFleet($latest);

        $jobOrder = $assignment->jobOrder;
        if ($jobOrder) {
            $jobOrder = $this->locationService->ensureCoordinates($jobOrder);
        }

        $pickup = $jobOrder
            ? GpsCoordinateValidator::pair(
                $jobOrder->pickup_latitude,
                $jobOrder->pickup_longitude,
                'fleet_pickup_'.$assignment->id,
            )
            : null;

        $destination = $jobOrder
            ? GpsCoordinateValidator::pair(
                $jobOrder->dropoff_latitude,
                $jobOrder->dropoff_longitude,
                'fleet_destination_'.$assignment->id,
            )
            : null;

        $route = null;
        $deliveryRoute = null;
        if ($pickup && $destination) {
            $deliveryRoute = $this->directions->route(
                $pickup['lat'],
                $pickup['lng'],
                $destination['lat'],
                $destination['lng'],
            );
        }

        if ($latest && $destination) {
            $route = $this->directions->route(
                (float) $latest->latitude,
                (float) $latest->longitude,
                $destination['lat'],
                $destination['lng'],
            );
        }

        $locationStatus = $this->buildLocationStatus($jobOrder, $pickup, $destination);

        LocationPipelineLogger::log('fleet_live_delivery', [
            'assignment_id' => $assignment->id,
            'job_order_id' => $assignment->job_order_id,
            'tracking_code' => $jobOrder?->tracking_code,
            'pickup_address' => $locationStatus['pickup_address'],
            'destination_address' => $locationStatus['destination_address'],
            'pickup' => $pickup,
            'destination' => $destination,
            'driver_gps' => $location,
            'location_warnings' => $locationStatus['warnings'],
            'route_source' => $route['source'] ?? null,
            'delivery_route_source' => $deliveryRoute['source'] ?? null,
            'distance_label' => $route['distance_label'] ?? null,
            'duration_label' => $route['duration_label'] ?? null,
            'driver_gps_at' => $location['at'] ?? null,
        ]);

        return [
            'id' => $assignment->id,
            'job_order_id' => $assignment->job_order_id,
            'status' => $assignment->status,
            'driver' => $assignment->driver,
            'vehicle' => $assignment->vehicle,
            'job_order' => $jobOrder,
            'pickup' => $pickup,
            'destination' => $destination,
            'location_status' => $locationStatus,
            'latest_delay_report' => $assignment->latestDelayReport,
            'latest_arrived_status_log' => $assignment->latestArrivedStatusLog,
            'delivery_documents' => $assignment->deliveryDocuments,
            'location' => $location,
            'route' => $route,
            'delivery_route' => $deliveryRoute,
        ];
    }

    /**
     * @param  array{lat: float, lng: float}|null  $pickup
     * @param  array{lat: float, lng: float}|null  $destination
     * @return array<string, mixed>
     */
    private function buildLocationStatus(?\App\Models\JobOrder $jobOrder, ?array $pickup, ?array $destination): array
    {
        $pickupAddress = $jobOrder
            ? trim($jobOrder->display_pickup ?: (string) ($jobOrder->pickup_location ?? ''))
            : '';
        $destinationAddress = $jobOrder
            ? trim($jobOrder->display_dropoff ?: (string) ($jobOrder->dropoff_location ?? ''))
            : '';

        $warnings = [];
        if ($pickup === null) {
            $warnings[] = $pickupAddress === ''
                ? 'Pickup address is missing for this delivery.'
                : "Could not map pickup location: {$pickupAddress}";
        }
        if ($destination === null) {
            $warnings[] = $destinationAddress === ''
                ? 'Destination address is missing for this delivery.'
                : "Could not map destination location: {$destinationAddress}";
        }

        return [
            'pickup_resolved' => $pickup !== null,
            'destination_resolved' => $destination !== null,
            'pickup_address' => $pickupAddress,
            'destination_address' => $destinationAddress,
            'pickup_coordinates' => $pickup,
            'destination_coordinates' => $destination,
            'warnings' => $warnings,
        ];
    }

    private function resolveLatestTrackingLog(DispatchAssignment $assignment): ?TrackingLog
    {
        $latest = $assignment->latestTrackingLog;
        $current = $this->driverLocationService->currentForAssignment($assignment);

        if ($current && $current->captured_at && (! $latest || $current->captured_at->gt($latest->captured_at))) {
            $latest = new TrackingLog([
                'assignment_id' => $assignment->id,
                'driver_id' => $assignment->driver_id,
                'latitude' => $current->latitude,
                'longitude' => $current->longitude,
                'accuracy_m' => $current->accuracy_m,
                'heading' => $current->heading,
                'speed_kmh' => $current->speed_kmh,
                'battery_level' => $current->battery_level,
                'captured_at' => $current->captured_at,
            ]);
        }

        if ($latest && ! GpsCoordinateValidator::isUsable($latest->latitude, $latest->longitude)) {
            LocationPipelineLogger::log('fleet_invalid_driver_gps', [
                'assignment_id' => $assignment->id,
                'latitude' => $latest->latitude,
                'longitude' => $latest->longitude,
            ]);

            return null;
        }

        return $latest;
    }
}
