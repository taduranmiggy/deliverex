<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Services\Gps\DriverLocationService;
use App\Services\Gps\RouteDirectionsService;
use App\Services\Gps\TrackingService;
use App\Support\GpsCoordinateValidator;

class FleetController extends Controller
{
    public function __construct(
        private TrackingService $trackingService,
        private DriverLocationService $driverLocationService,
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

            $pickup = $jobOrder
                ? GpsCoordinateValidator::pair($jobOrder->pickup_latitude, $jobOrder->pickup_longitude, 'manager_fleet_pickup')
                : null;
            $destination = $jobOrder
                ? GpsCoordinateValidator::pair($jobOrder->dropoff_latitude, $jobOrder->dropoff_longitude, 'manager_fleet_destination')
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
