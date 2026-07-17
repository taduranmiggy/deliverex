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
        if ($latest && $destination) {
            $route = $this->directions->route(
                (float) $latest->latitude,
                (float) $latest->longitude,
                $destination['lat'],
                $destination['lng'],
            );
        }

        LocationPipelineLogger::log('fleet_live_delivery', [
            'assignment_id' => $assignment->id,
            'job_order_id' => $assignment->job_order_id,
            'tracking_code' => $jobOrder?->tracking_code,
            'pickup_address' => $jobOrder?->display_pickup,
            'destination_address' => $jobOrder?->display_dropoff,
            'pickup' => $pickup,
            'destination' => $destination,
            'driver_gps' => $location,
            'route_source' => $route['source'] ?? null,
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
            'latest_delay_report' => $assignment->latestDelayReport,
            'latest_arrived_status_log' => $assignment->latestArrivedStatusLog,
            'delivery_documents' => $assignment->deliveryDocuments,
            'location' => $location,
            'route' => $route,
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
