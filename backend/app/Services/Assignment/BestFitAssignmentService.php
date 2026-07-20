<?php

namespace App\Services\Assignment;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\DriverVehicleAssignment;
use App\Models\JobOrder;
use App\Models\TrackingLog;
use App\Models\Vehicle;
use App\Services\Driver\DriverAvailabilityService;
use App\Services\Fleet\VehicleAvailabilityService;
use App\Support\AssignmentScheduleConflict;
use App\Support\DeliveryStatus;
use App\Support\DriverLicenseValidator;
use Illuminate\Support\Collection;

class BestFitAssignmentService
{
    private const SCORE_MAX = 100;

    private const WEIGHT_VEHICLE = 40;
    private const WEIGHT_CAPACITY = 20;
    private const WEIGHT_AVAILABILITY = 15;
    private const WEIGHT_SCHEDULE = 10;
    private const WEIGHT_DISTANCE = 10;
    private const WEIGHT_WORKLOAD = 5;

    public function __construct(
        private DriverAvailabilityService $driverAvailability,
        private VehicleAvailabilityService $vehicleAvailability,
    ) {
    }

    /**
     * Rank driver × vehicle pairs for a job using a best-fit score (higher is better).
     */
    public function recommend(JobOrder $jobOrder): array
    {
        $jobOrder->loadMissing('preferredVehicleType', 'quarry');

        $requiredVolume = $this->requiredVolume($jobOrder);
        $requiredTypeName = $jobOrder->preferredVehicleType?->name ?? $jobOrder->vehicle_type_required;
        $requiredTypeNormalized = $this->normalizeVehicleTypeName($requiredTypeName);

        $drivers = $this->eligibleDrivers($jobOrder);
        $vehicles = $this->eligibleVehicles($jobOrder, $requiredTypeNormalized, $requiredVolume);

        if ($drivers->isEmpty() || $vehicles->isEmpty()) {
            return [];
        }

        $context = $this->buildScoringContext($jobOrder, $drivers);
        $recommendations = [];

        foreach ($drivers as $driver) {
            foreach ($vehicles as $vehicle) {
                $scored = $this->scorePair(
                    $jobOrder,
                    $driver,
                    $vehicle,
                    $requiredVolume,
                    $requiredTypeNormalized,
                    $context,
                );

                if ($scored === null) {
                    continue;
                }

                $vehicleCapacity = $this->vehicleVolumeCapacity($vehicle);
                $unusedCapacity = $requiredVolume !== null && $vehicleCapacity !== null
                    ? round($vehicleCapacity - $requiredVolume, 3)
                    : null;
                $loadEfficiencyPercent = $requiredVolume !== null
                    && $requiredVolume > 0
                    && $vehicleCapacity !== null
                    && $vehicleCapacity > 0
                    ? (int) round(min(1, max(0, $requiredVolume / $vehicleCapacity)) * 100)
                    : null;

                $recommendations[] = array_merge($scored, [
                    'driver_id'               => $driver->id,
                    'driver_user_id'          => $driver->user_id,
                    'driver_has_account'      => (bool) $driver->user_id,
                    'driver_name'             => $driver->full_name ?: $driver->user?->name,
                    'vehicle_id'              => $vehicle->id,
                    'vehicle_plate'           => $vehicle->plate_no,
                    'vehicle_type'            => $vehicle->vehicleType?->name ?? $vehicle->type,
                    'vehicle_capacity'        => $vehicle->capacity,
                    'vehicle_cbm_capacity'    => $vehicleCapacity,
                    'load_volume'             => $requiredVolume,
                    'unused_capacity'         => $unusedCapacity,
                    'load_efficiency_percent' => $loadEfficiencyPercent,
                    'score_max'               => self::SCORE_MAX,
                    'feasible'                => true,
                    'driver_recent_assignments' => $context['recent_assignments'][$driver->id] ?? 0,
                    'driver_last_assigned_at'   => $context['last_assigned_at'][$driver->id] ?? null,
                    'driver_completed_today'    => $context['completed_today'][$driver->id] ?? 0,
                ]);
            }
        }

        usort($recommendations, function (array $a, array $b) {
            $scoreCmp = $b['score'] <=> $a['score'];
            if ($scoreCmp !== 0) {
                return $scoreCmp;
            }

            $todayCmp = ($a['driver_completed_today'] ?? 0) <=> ($b['driver_completed_today'] ?? 0);
            if ($todayCmp !== 0) {
                return $todayCmp;
            }

            $recentCmp = ($a['driver_recent_assignments'] ?? 0) <=> ($b['driver_recent_assignments'] ?? 0);
            if ($recentCmp !== 0) {
                return $recentCmp;
            }

            $aLast = $a['driver_last_assigned_at'] ? strtotime((string) $a['driver_last_assigned_at']) : 0;
            $bLast = $b['driver_last_assigned_at'] ? strtotime((string) $b['driver_last_assigned_at']) : 0;

            return $aLast <=> $bLast;
        });

        return $this->diversifyByDriver($recommendations);
    }

    /**
     * Lightweight eligibility counts for Fleet Dispatch UI (no scoring).
     *
     * @return array{total_drivers:int,eligible_drivers:int,total_vehicles:int,eligible_vehicles:int}
     */
    public function eligibilitySummary(JobOrder $jobOrder): array
    {
        $jobOrder->loadMissing('preferredVehicleType', 'quarry');

        $requiredVolume = $this->requiredVolume($jobOrder);
        $requiredTypeNormalized = $this->normalizeVehicleTypeName(
            $jobOrder->preferredVehicleType?->name ?? $jobOrder->vehicle_type_required
        );

        $eligibleDrivers = $this->eligibleDrivers($jobOrder);
        $eligibleVehicles = $this->eligibleVehicles($jobOrder, $requiredTypeNormalized, $requiredVolume);

        return [
            'total_drivers'     => Driver::query()->count(),
            'eligible_drivers'  => $eligibleDrivers->count(),
            'total_vehicles'    => Vehicle::query()->count(),
            'eligible_vehicles' => $eligibleVehicles->count(),
        ];
    }

    public function overrideOptions(JobOrder $jobOrder): array
    {
        $jobOrder->loadMissing('preferredVehicleType');

        $requiredVolume = $this->requiredVolume($jobOrder);
        $requiredTypeNormalized = $this->normalizeVehicleTypeName(
            $jobOrder->preferredVehicleType?->name ?? $jobOrder->vehicle_type_required
        );

        $drivers = Driver::query()
            ->with('user')
            ->where(function ($query) {
                $query->where('status', '!=', 'inactive')
                    ->orWhereNull('status');
            })
            ->orderBy('full_name')
            ->get()
            ->map(fn (Driver $driver) => $this->formatOverrideDriver($driver, $jobOrder))
            ->sortByDesc('override_selectable')
            ->values()
            ->all();

        $vehicles = Vehicle::query()
            ->with('vehicleType')
            ->whereNotIn('status', ['maintenance', 'unavailable', 'inactive'])
            ->orderBy('plate_no')
            ->get()
            ->map(fn (Vehicle $vehicle) => $this->formatOverrideVehicle(
                $vehicle,
                $jobOrder,
                $requiredTypeNormalized,
                $requiredVolume,
            ))
            ->sortByDesc('override_selectable')
            ->values()
            ->all();

        return [
            'drivers'   => $drivers,
            'vehicles'  => $vehicles,
            'pairings'  => $this->buildOverridePairings($drivers, $vehicles),
        ];
    }

    /**
     * Manual override pairings — relaxed vs Best-Fit (type/capacity/busy are warnings, not hard filters).
     *
     * @param  list<array<string,mixed>>  $drivers
     * @param  list<array<string,mixed>>  $vehicles
     * @return list<array<string,mixed>>
     */
    public function buildOverridePairings(array $drivers, array $vehicles, int $limit = 150): array
    {
        $selectableDrivers = array_values(array_filter(
            $drivers,
            fn (array $row): bool => (bool) ($row['override_selectable'] ?? false),
        ));
        $selectableVehicles = array_values(array_filter(
            $vehicles,
            fn (array $row): bool => (bool) ($row['override_selectable'] ?? false),
        ));

        if ($selectableDrivers === [] || $selectableVehicles === []) {
            return [];
        }

        $vehicleById = [];
        foreach ($selectableVehicles as $vehicle) {
            $vehicleById[(int) $vehicle['id']] = $vehicle;
        }

        $seen = [];
        $pairings = [];

        $appendPair = function (array $driver, array $vehicle, bool $preferred = false) use (&$pairings, &$seen, $limit): bool {
            $key = $driver['id'].'-'.$vehicle['id'];
            if (isset($seen[$key])) {
                return count($pairings) >= $limit;
            }

            $seen[$key] = true;
            $warnings = array_values(array_unique(array_merge(
                $driver['override_warnings'] ?? [],
                $vehicle['override_warnings'] ?? [],
            )));

            $pairings[] = [
                'driver_id'            => $driver['id'],
                'driver_name'          => $driver['name'],
                'driver_has_account'   => (bool) ($driver['has_login_account'] ?? false),
                'vehicle_id'           => $vehicle['id'],
                'vehicle_plate'        => $vehicle['plate_no'],
                'vehicle_type'         => $vehicle['vehicle_type'] ?? null,
                'vehicle_cbm_capacity' => $vehicle['cbm_capacity'] ?? null,
                'meets_capacity'       => (bool) ($vehicle['meets_capacity'] ?? true),
                'meets_type'           => (bool) ($vehicle['meets_type'] ?? true),
                'warnings'             => $warnings,
                'is_preferred_pair'    => $preferred,
            ];

            return count($pairings) >= $limit;
        };

        $preferredLinks = DriverVehicleAssignment::query()
            ->where('status', 'active')
            ->orderByDesc('is_primary')
            ->get(['driver_id', 'vehicle_id']);

        foreach ($preferredLinks as $link) {
            $driver = collect($selectableDrivers)->firstWhere('id', $link->driver_id);
            $vehicle = $vehicleById[(int) $link->vehicle_id] ?? null;
            if (! $driver || ! $vehicle) {
                continue;
            }

            if ($appendPair($driver, $vehicle, true)) {
                return $this->markPreferredPairings($pairings);
            }
        }

        foreach ($selectableDrivers as $driver) {
            foreach ($selectableVehicles as $vehicle) {
                if ($appendPair($driver, $vehicle)) {
                    return $this->markPreferredPairings($pairings);
                }
            }
        }

        return $this->markPreferredPairings($pairings);
    }

    /**
     * @param  list<array<string,mixed>>  $pairings
     * @return list<array<string,mixed>>
     */
    private function markPreferredPairings(array $pairings): array
    {
        usort($pairings, function (array $a, array $b): int {
            $pref = ((int) ($b['is_preferred_pair'] ?? false)) <=> ((int) ($a['is_preferred_pair'] ?? false));
            if ($pref !== 0) {
                return $pref;
            }

            $fitA = ((int) ($a['meets_type'] ?? false)) + ((int) ($a['meets_capacity'] ?? false));
            $fitB = ((int) ($b['meets_type'] ?? false)) + ((int) ($b['meets_capacity'] ?? false));
            if ($fitB !== $fitA) {
                return $fitB <=> $fitA;
            }

            return strcasecmp((string) ($a['driver_name'] ?? ''), (string) ($b['driver_name'] ?? ''));
        });

        return $pairings;
    }

    /** @return array<string, mixed> */
    private function formatOverrideDriver(Driver $driver, JobOrder $jobOrder): array
    {
        $license = DriverLicenseValidator::summary($driver);
        $blockers = [];

        if (! $driver->user_id) {
            $blockers[] = 'no_login_account';
        }
        if ($this->driverAvailability->isAdminUnavailable($driver)) {
            $blockers[] = 'admin_offline';
        }
        if (! $this->driverAvailability->isAssignable($driver)) {
            $blockers[] = 'active_assignment';
        }
        if (AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder)) {
            $blockers[] = 'schedule_conflict';
        }

        $warnings = [];
        if (! $driver->user_id) {
            $warnings[] = 'No login account — driver will not receive mobile app notifications until an account is generated.';
        }
        if (! $this->driverAvailability->isAssignable($driver)) {
            $warnings[] = 'Driver appears busy on another assignment. Stale assignments are repaired automatically before dispatch.';
        }
        if (! $license['eligible']) {
            $warnings[] = $license['message'] ?? DriverLicenseValidator::INELIGIBILITY_MESSAGE;
        }

        $overrideSelectable = ! $this->driverAvailability->isAdminUnavailable($driver)
            && ! AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder);

        return [
            'id'                  => $driver->id,
            'user_id'             => $driver->user_id,
            'has_login_account'   => (bool) $driver->user_id,
            'name'                => $driver->full_name ?: $driver->user?->name ?: ('Driver #'.$driver->id),
            'availability'        => $driver->availability ?? 'available',
            'status'              => $driver->status ?? 'active',
            'override_selectable' => $overrideSelectable,
            'override_warnings'   => $warnings,
            'blockers'            => $blockers,
            'eligible'            => $license['eligible'],
            'license_status'      => $license['license_status'],
            'license_no'          => $license['license_no'],
            'license_expiry'      => $license['license_expiry'],
            'message'             => $license['message'],
        ];
    }

    /** @return array<string, mixed> */
    private function formatOverrideVehicle(
        Vehicle $vehicle,
        JobOrder $jobOrder,
        ?string $requiredTypeNormalized,
        ?float $requiredVolume,
    ): array {
        $blockers = [];
        $warnings = [];

        if (! $this->vehicleAvailability->isAssignable($vehicle)) {
            $blockers[] = 'active_assignment';
        }
        if (AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder)) {
            $blockers[] = 'schedule_conflict';
        }

        $meetsCapacity = $this->vehicleMeetsCapacity($vehicle, $requiredVolume);
        $meetsType = $requiredTypeNormalized === null
            || $this->vehicleMatchesRequiredType($vehicle, $requiredTypeNormalized, $jobOrder);

        if (! $meetsCapacity) {
            $warnings[] = 'Vehicle capacity is below the job load requirement.';
        }
        if (! $meetsType) {
            $warnings[] = 'Vehicle type does not match the job requirement.';
        }
        if (! $this->vehicleAvailability->isAssignable($vehicle)) {
            $warnings[] = 'Vehicle appears busy on another assignment. Stale assignments are repaired automatically before dispatch.';
        }

        $overrideSelectable = ! $this->vehicleAvailability->isAdminLocked($vehicle)
            && ! AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder);

        return [
            'id'                  => $vehicle->id,
            'plate_no'            => $vehicle->plate_no,
            'status'              => $vehicle->status ?? 'available',
            'vehicle_type'        => $vehicle->vehicleType?->name ?? $vehicle->type,
            'cbm_capacity'        => $this->vehicleVolumeCapacity($vehicle),
            'meets_capacity'      => $meetsCapacity,
            'meets_type'          => $meetsType,
            'override_selectable' => $overrideSelectable,
            'override_warnings'   => $warnings,
            'blockers'            => $blockers,
        ];
    }

    private function buildScoringContext(JobOrder $jobOrder, Collection $drivers): array
    {
        $driverIds = $drivers->pluck('id')->all();

        $recentStats = $this->driverDiversityStats($driverIds);
        $recentAssignments = [];
        $lastAssignedAt = [];
        foreach ($recentStats as $driverId => $stats) {
            $recentAssignments[$driverId] = $stats['recent_assignments'];
            $lastAssignedAt[$driverId] = $stats['last_assigned_at'];
        }

        $completedToday = DispatchAssignment::query()
            ->selectRaw('driver_id, COUNT(*) as completed_count')
            ->whereIn('driver_id', $driverIds)
            ->where('status', DeliveryStatus::COMPLETED)
            ->whereDate('completed_at', today())
            ->groupBy('driver_id')
            ->pluck('completed_count', 'driver_id')
            ->map(fn ($count) => (int) $count)
            ->all();

        $maxCompletedToday = empty($completedToday) ? 0 : max($completedToday);

        return [
            'recent_assignments'  => $recentAssignments,
            'last_assigned_at'    => $lastAssignedAt,
            'completed_today'   => $completedToday,
            'max_completed_today' => $maxCompletedToday,
            'latest_locations'    => $this->latestDriverLocations($driverIds),
            'reference_coords'    => $this->resolveReferenceCoordinates($jobOrder),
        ];
    }

    /**
     * @return array{lat: float, lng: float, source: string}|null
     */
    private function resolveReferenceCoordinates(JobOrder $jobOrder): ?array
    {
        if ($jobOrder->dropoff_latitude !== null && $jobOrder->dropoff_longitude !== null) {
            return [
                'lat'    => (float) $jobOrder->dropoff_latitude,
                'lng'    => (float) $jobOrder->dropoff_longitude,
                'source' => 'delivery_zone',
            ];
        }

        return null;
    }

    /**
     * @return array<int, object{latitude: float, longitude: float}>
     */
    private function latestDriverLocations(array $driverIds): array
    {
        if ($driverIds === []) {
            return [];
        }

        $rows = TrackingLog::query()
            ->select([
                'dispatch_assignments.driver_id',
                'tracking_logs.latitude',
                'tracking_logs.longitude',
                'tracking_logs.captured_at',
            ])
            ->join('dispatch_assignments', 'dispatch_assignments.id', '=', 'tracking_logs.assignment_id')
            ->whereIn('dispatch_assignments.driver_id', $driverIds)
            ->whereIn('dispatch_assignments.status', DeliveryStatus::availabilityBlockingRawValues())
            ->orderByDesc('tracking_logs.captured_at')
            ->orderByDesc('tracking_logs.id')
            ->get();

        $latest = [];
        foreach ($rows as $row) {
            $driverId = (int) $row->driver_id;
            if (! isset($latest[$driverId])) {
                $latest[$driverId] = $row;
            }
        }

        return $latest;
    }

    private function eligibleDrivers(JobOrder $jobOrder): Collection
    {
        return Driver::query()
            ->with('user')
            ->where(function ($q) {
                $q->where('status', '!=', 'inactive')
                    ->orWhereNull('status');
            })
            ->get()
            ->filter(function (Driver $driver) use ($jobOrder) {
                if (! DriverLicenseValidator::isEligible($driver)) {
                    return false;
                }

                if ($this->driverAvailability->isAdminUnavailable($driver)) {
                    return false;
                }

                if (! $this->driverAvailability->isAssignable($driver)) {
                    return false;
                }

                return ! AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder);
            })
            ->values();
    }

    private function eligibleVehicles(
        JobOrder $jobOrder,
        ?string $requiredTypeNormalized,
        ?float $requiredVolume,
    ): Collection {
        return Vehicle::query()
            ->with('vehicleType')
            ->whereNotIn('status', ['maintenance', 'unavailable', 'inactive'])
            ->get()
            ->filter(function (Vehicle $vehicle) use ($jobOrder, $requiredTypeNormalized, $requiredVolume) {
                if (! $this->vehicleAvailability->isAssignable($vehicle)) {
                    return false;
                }

                if (AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder)) {
                    return false;
                }

                if (! $this->vehicleMeetsCapacity($vehicle, $requiredVolume)) {
                    return false;
                }

                if ($requiredTypeNormalized !== null
                    && ! $this->vehicleMatchesRequiredType($vehicle, $requiredTypeNormalized, $jobOrder)) {
                    return false;
                }

                return true;
            })
            ->values();
    }

    private function scorePair(
        JobOrder $jobOrder,
        Driver $driver,
        Vehicle $vehicle,
        ?float $requiredVolume,
        ?string $requiredTypeNormalized,
        array $context,
    ): ?array {
        if (! $this->driverAvailability->isAssignable($driver)) {
            return null;
        }

        if (AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder)
            || AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder)) {
            return null;
        }

        if (! $this->vehicleMeetsCapacity($vehicle, $requiredVolume)) {
            return null;
        }

        if ($requiredTypeNormalized !== null
            && ! $this->vehicleMatchesRequiredType($vehicle, $requiredTypeNormalized, $jobOrder)) {
            return null;
        }

        $factors = [];

        // 1. Vehicle compatibility (40)
        $vehicleMatched = $requiredTypeNormalized === null
            || $this->vehicleMatchesRequiredType($vehicle, $requiredTypeNormalized, $jobOrder);
        $vehicleContribution = $vehicleMatched ? self::WEIGHT_VEHICLE : 0;
        $vehicleDetail = $requiredTypeNormalized === null
            ? 'No specific vehicle type required for this job.'
            : ($vehicleMatched
                ? 'Vehicle type exactly matches the job requirement.'
                : 'Vehicle type does not match the job requirement.');

        $factors[] = $this->factor(
            'vehicle_compatibility',
            'Vehicle Match',
            $vehicleMatched,
            $vehicleContribution,
            self::WEIGHT_VEHICLE,
            $vehicleDetail,
        );

        // 2. Capacity efficiency (20)
        [$capacityContribution, $capacityMatched, $capacityDetail] = $this->scoreCapacityEfficiency(
            $vehicle,
            $requiredVolume,
        );
        $factors[] = $this->factor(
            'capacity_efficiency',
            'Capacity Efficiency',
            $capacityMatched,
            $capacityContribution,
            self::WEIGHT_CAPACITY,
            $capacityDetail,
        );

        // 3. Driver availability (15) — hard gate, full points when eligible
        $availabilityMatched = true;
        $availabilityDetail = 'Driver is available with no blocking active assignments.';
        $factors[] = $this->factor(
            'driver_availability',
            'Availability',
            $availabilityMatched,
            self::WEIGHT_AVAILABILITY,
            self::WEIGHT_AVAILABILITY,
            $availabilityDetail,
        );

        // 4. Schedule compatibility (10) — hard gate via eligible filters
        $scheduleMatched = true;
        $scheduleDetail = 'Driver and vehicle schedules do not conflict with this job window.';
        if ($vehicle->status === 'assigned') {
            $scheduleDetail = 'Vehicle is assigned elsewhere but the schedule window does not overlap.';
        }
        $factors[] = $this->factor(
            'schedule_compatibility',
            'Schedule',
            $scheduleMatched,
            self::WEIGHT_SCHEDULE,
            self::WEIGHT_SCHEDULE,
            $scheduleDetail,
        );

        // 5. Distance to pickup / job area (10)
        [$distanceContribution, $distanceMatched, $distanceDetail] = $this->scoreDistance(
            $driver,
            $context,
        );
        $factors[] = $this->factor(
            'distance_to_pickup',
            'Distance',
            $distanceMatched,
            $distanceContribution,
            self::WEIGHT_DISTANCE,
            $distanceDetail,
        );

        // 6. Workload distribution (5)
        [$workloadContribution, $workloadMatched, $workloadDetail] = $this->scoreWorkload(
            $driver,
            $context,
        );
        $factors[] = $this->factor(
            'workload_distribution',
            'Workload',
            $workloadMatched,
            $workloadContribution,
            self::WEIGHT_WORKLOAD,
            $workloadDetail,
        );

        $score = array_sum(array_column($factors, 'contribution'));
        $score = min(self::SCORE_MAX, max(0, $score));

        $reasons = array_values(array_filter(array_map(
            fn (array $factor) => $factor['contribution'] > 0 ? $factor['detail'] : null,
            $factors,
        )));

        return [
            'score'    => $score,
            'factors'  => $factors,
            'reasons'  => $reasons,
        ];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreCapacityEfficiency(Vehicle $vehicle, ?float $requiredVolume): array
    {
        $capacity = $this->vehicleVolumeCapacity($vehicle);

        if ($requiredVolume === null || $requiredVolume <= 0 || $capacity === null || $capacity <= 0) {
            return [10, false, 'Capacity metadata unavailable; neutral efficiency score applied.'];
        }

        $utilization = min(1, $requiredVolume / $capacity);
        $contribution = (int) round(self::WEIGHT_CAPACITY * min(1, $utilization / 0.85));
        $contribution = max(0, min(self::WEIGHT_CAPACITY, $contribution));
        $percent = (int) round($utilization * 100);
        $unused = round($capacity - $requiredVolume, 2);

        $matched = $utilization >= 0.75;
        $detail = "Load uses {$percent}% of vehicle capacity ({$unused} m³ unused).";

        if ($utilization >= 0.85) {
            $detail = "Excellent fit: {$percent}% utilization with {$unused} m³ unused.";
        } elseif ($utilization < 0.55) {
            $detail = "Oversized vehicle: only {$percent}% utilization ({$unused} m³ unused).";
        }

        return [$contribution, $matched, $detail];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreDistance(Driver $driver, array $context): array
    {
        $reference = $context['reference_coords'] ?? null;
        $location = $context['latest_locations'][$driver->id] ?? null;

        if (! $reference || ! $location) {
            return [5, false, 'Distance unavailable (missing driver GPS or job coordinates).'];
        }

        $distanceKm = $this->haversineKm(
            (float) $location->latitude,
            (float) $location->longitude,
            $reference['lat'],
            $reference['lng'],
        );

        $contribution = (int) round(self::WEIGHT_DISTANCE * max(0, 1 - min(1, $distanceKm / 80)));
        $contribution = max(0, min(self::WEIGHT_DISTANCE, $contribution));
        $matched = $distanceKm <= 40;

        $detail = sprintf(
            'Driver last known position is %.1f km from the %s reference point.',
            $distanceKm,
            $reference['source'] === 'delivery_zone' ? 'delivery zone' : 'pickup area',
        );

        return [$contribution, $matched, $detail];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreWorkload(Driver $driver, array $context): array
    {
        $completedToday = (int) ($context['completed_today'][$driver->id] ?? 0);
        $maxToday = (int) ($context['max_completed_today'] ?? 0);

        if ($maxToday === 0) {
            return [self::WEIGHT_WORKLOAD, true, 'No completed deliveries today across the candidate pool.'];
        }

        $contribution = (int) round(self::WEIGHT_WORKLOAD * (1 - ($completedToday / max(1, $maxToday))));
        $contribution = max(0, min(self::WEIGHT_WORKLOAD, $contribution));
        $matched = $completedToday <= (int) floor($maxToday / 2);

        $detail = $completedToday === 0
            ? 'Driver has no completed deliveries today.'
            : "Driver completed {$completedToday} deliver".($completedToday === 1 ? 'y' : 'ies').' today.';

        return [$contribution, $matched, $detail];
    }

    private function driverDiversityStats(array $driverIds): array
    {
        if ($driverIds === []) {
            return [];
        }

        $rows = DispatchAssignment::query()
            ->selectRaw('driver_id, COUNT(*) as recent_assignments, MAX(assigned_at) as last_assigned_at')
            ->whereIn('driver_id', $driverIds)
            ->whereNotNull('assigned_at')
            ->where('assigned_at', '>=', now()->subDays(7))
            ->groupBy('driver_id')
            ->get();

        $stats = [];
        foreach ($rows as $row) {
            $stats[(int) $row->driver_id] = [
                'recent_assignments' => (int) ($row->recent_assignments ?? 0),
                'last_assigned_at'   => $row->last_assigned_at,
            ];
        }

        return $stats;
    }

    private function diversifyByDriver(array $recommendations): array
    {
        $seenDrivers = [];
        $uniqueFirstPass = [];
        $remainder = [];

        foreach ($recommendations as $rec) {
            $driverId = (int) ($rec['driver_id'] ?? 0);
            if ($driverId > 0 && ! isset($seenDrivers[$driverId])) {
                $seenDrivers[$driverId] = true;
                $uniqueFirstPass[] = $rec;
                continue;
            }
            $remainder[] = $rec;
        }

        return array_merge($uniqueFirstPass, $remainder);
    }

    private function vehicleMeetsCapacity(Vehicle $vehicle, ?float $requiredVolume): bool
    {
        if ($requiredVolume === null || $requiredVolume <= 0) {
            return true;
        }

        $maxVolume = $this->vehicleVolumeCapacity($vehicle);

        return $maxVolume === null || $requiredVolume <= $maxVolume;
    }

    private function vehicleVolumeCapacity(Vehicle $vehicle): ?float
    {
        if ($vehicle->cbm_capacity !== null) {
            return (float) $vehicle->cbm_capacity;
        }
        if ($vehicle->max_volume_m3 !== null) {
            return (float) $vehicle->max_volume_m3;
        }
        if ($vehicle->rounded_cbm_capacity !== null) {
            return (float) $vehicle->rounded_cbm_capacity;
        }

        return null;
    }

    private function requiredVolume(JobOrder $jobOrder): ?float
    {
        if ($jobOrder->load_volume_m3 !== null) {
            return (float) $jobOrder->load_volume_m3;
        }

        return $jobOrder->volume_m3 !== null ? (float) $jobOrder->volume_m3 : null;
    }

    private function vehicleMatchesRequiredType(Vehicle $vehicle, ?string $requiredTypeNormalized, JobOrder $jobOrder): bool
    {
        if ($jobOrder->preferred_vehicle_type_id && $vehicle->vehicle_type_id) {
            if ((int) $vehicle->vehicle_type_id === (int) $jobOrder->preferred_vehicle_type_id) {
                return true;
            }
        }

        if ($requiredTypeNormalized === null) {
            return true;
        }

        $actual = $this->normalizeVehicleTypeName($vehicle->vehicleType?->name ?? $vehicle->type);

        return $actual !== null && $actual === $requiredTypeNormalized;
    }

    private function normalizeVehicleTypeName(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = mb_strtolower(trim($value));

        return $normalized === '' ? null : $normalized;
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return $earthRadius * 2 * asin(min(1, sqrt($a)));
    }

    private function factor(
        string $key,
        string $label,
        bool $matched,
        int $contribution,
        int $max,
        string $detail,
    ): array {
        return [
            'key'          => $key,
            'label'        => $label,
            'matched'      => $matched,
            'contribution' => min($max, max(0, $contribution)),
            'max'          => $max,
            'detail'       => $detail,
        ];
    }
}
