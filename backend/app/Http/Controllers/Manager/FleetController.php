<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Services\Delivery\JobOrderLocationService;
use App\Services\Gps\DriverLocationService;
use App\Services\Gps\RouteDirectionsService;
use App\Services\Gps\TrackingService;

class FleetController extends Controller
{
    public function __construct(
        private TrackingService $trackingService,
        private DriverLocationService $driverLocationService,
        private JobOrderLocationService $locationService,
        private RouteDirectionsService $directions,
    ) {
    }

    public function index()
    {
        $assignments = DispatchAssignment::with('jobOrder', 'driver.user', 'vehicle')
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->latest('assigned_at')
            ->get();

        $data = $assignments->map(function (DispatchAssignment $a) {
            $latest = $this->trackingService->latestForAssignment($a);
            $current = $this->driverLocationService->currentForAssignment($a);

            if ($current && $current->captured_at && (! $latest || $current->captured_at->gt($latest->captured_at))) {
                $latest = new \App\Models\TrackingLog([
                    'assignment_id' => $a->id,
                    'driver_id' => $a->driver_id,
                    'latitude' => $current->latitude,
                    'longitude' => $current->longitude,
                    'accuracy_m' => $current->accuracy_m,
                    'heading' => $current->heading,
                    'speed_kmh' => $current->speed_kmh,
                    'battery_level' => $current->battery_level,
                    'captured_at' => $current->captured_at,
                ]);
            }

            $jobOrder = $a->jobOrder;
            if ($jobOrder) {
                $jobOrder = $this->locationService->ensureCoordinates($jobOrder);
            }

            $pickup = $jobOrder && is_numeric($jobOrder->pickup_latitude) && is_numeric($jobOrder->pickup_longitude)
                ? ['lat' => (float) $jobOrder->pickup_latitude, 'lng' => (float) $jobOrder->pickup_longitude]
                : null;
            $destination = $jobOrder && is_numeric($jobOrder->dropoff_latitude) && is_numeric($jobOrder->dropoff_longitude)
                ? ['lat' => (float) $jobOrder->dropoff_latitude, 'lng' => (float) $jobOrder->dropoff_longitude]
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

            return [
                'id' => $a->id,
                'status' => $a->status,
                'driver' => $a->driver?->user?->name,
                'vehicle' => $a->vehicle?->plate_no,
                'job_order' => $a->jobOrder,
                'pickup' => $pickup,
                'destination' => $destination,
                'gps' => $this->trackingService->formatForFleet($latest),
                'route' => $route,
                'route_history' => $this->driverLocationService->tripHistoryForAssignment($a, 100),
            ];
        });

        return response()->json(['data' => $data]);
    }
}
