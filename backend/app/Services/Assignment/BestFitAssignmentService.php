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
use App\Support\VehicleTypeMatcher;
use App\Support\VehicleVolumeResolver;
use Illuminate\Support\Collection;

class BestFitAssignmentService
{
    public const RECOMMENDATION_LIMIT = 12;

    private const SCORE_MAX = 100;

    private const WEIGHT_VEHICLE_CAPACITY = 25;
    private const WEIGHT_DRIVER_AVAILABILITY = 15;
    private const WEIGHT_LOAD_EFFICIENCY = 20;
    private const WEIGHT_DISTANCE = 15;
    private const WEIGHT_VEHICLE_TYPE = 15;
    private const WEIGHT_SCHEDULE = 10;

    private int $lastTotalScoredPairings = 0;

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
        $requiredTypeNormalized = VehicleTypeMatcher::normalize($requiredTypeName);

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
                    'score_percent'           => (int) round($scored['score']),
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

        return $this->finalizeRecommendations($recommendations);
    }

    public function lastTotalScoredPairings(): int
    {
        return $this->lastTotalScoredPairings;
    }

    /**
     * @param  list<array<string, mixed>>  $recommendations
     * @return list<array<string, mixed>>
     */
    private function finalizeRecommendations(array $recommendations): array
    {
        $this->lastTotalScoredPairings = count($recommendations);

        return array_slice(
            $this->diversifyByDriver($recommendations),
            0,
            self::RECOMMENDATION_LIMIT,
        );
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
        $requiredTypeNormalized = VehicleTypeMatcher::normalize(
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
        $requiredTypeNormalized = VehicleTypeMatcher::normalize(
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
            'recent_assignments'    => $recentAssignments,
            'last_assigned_at'      => $lastAssignedAt,
            'completed_today'       => $completedToday,
            'max_completed_today'   => $maxCompletedToday,
            'latest_locations'      => $this->latestDriverLocations($driverIds),
            'reference_coords'      => $this->resolveReferenceCoordinates($jobOrder),
        ];
    }

    /**
     * @return array{lat: float, lng: float, source: string}|null
     */
    private function resolveReferenceCoordinates(JobOrder $jobOrder): ?array
    {
        if ($jobOrder->pickup_latitude !== null && $jobOrder->pickup_longitude !== null) {
            return [
                'lat'    => (float) $jobOrder->pickup_latitude,
                'lng'    => (float) $jobOrder->pickup_longitude,
                'source' => 'pickup',
            ];
        }

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
            ->where(function ($query) {
                $query->whereNotIn('status', ['inactive', 'suspended', 'archived'])
                    ->orWhereNull('status');
            })
            ->get()
            ->filter(function (Driver $driver) {
                $licenseStatus = DriverLicenseValidator::status($driver);
                if (in_array($licenseStatus, [
                    DriverLicenseValidator::STATUS_MISSING,
                    DriverLicenseValidator::STATUS_EXPIRED,
                ], true)) {
                    return false;
                }

                return ! $this->driverAvailability->hasActiveAssignments($driver);
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
            ->where(function ($query) {
                $query->whereNotIn('status', ['maintenance', 'unavailable', 'inactive', 'archived'])
                    ->orWhereNull('status');
            })
            ->get()
            ->filter(function (Vehicle $vehicle) use ($requiredVolume) {
                if (! $this->vehicleMeetsCapacity($vehicle, $requiredVolume)) {
                    return false;
                }

                return ! $this->vehicleAvailability->hasActiveAssignments($vehicle);
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
        if ($this->driverAvailability->hasActiveAssignments($driver)
            || $this->vehicleAvailability->hasActiveAssignments($vehicle)) {
            return null;
        }

        if (! $this->vehicleMeetsCapacity($vehicle, $requiredVolume)) {
            return null;
        }

        $factors = [];

        [$capacityContribution, $capacityMatched, $capacityDetail] = $this->scoreVehicleCapacityMatch(
            $vehicle,
            $requiredVolume,
        );
        $factors[] = $this->factor(
            'vehicle_capacity_match',
            'Vehicle Capacity Match',
            $capacityMatched,
            $capacityContribution,
            self::WEIGHT_VEHICLE_CAPACITY,
            $capacityDetail,
        );

        [$availabilityContribution, $availabilityMatched, $availabilityDetail] = $this->scoreDriverAvailability($driver);
        $factors[] = $this->factor(
            'driver_availability',
            'Driver Availability',
            $availabilityMatched,
            $availabilityContribution,
            self::WEIGHT_DRIVER_AVAILABILITY,
            $availabilityDetail,
        );

        [$efficiencyContribution, $efficiencyMatched, $efficiencyDetail] = $this->scoreLoadEfficiency(
            $vehicle,
            $requiredVolume,
        );
        $factors[] = $this->factor(
            'load_efficiency',
            'Load Efficiency',
            $efficiencyMatched,
            $efficiencyContribution,
            self::WEIGHT_LOAD_EFFICIENCY,
            $efficiencyDetail,
        );

        [$distanceContribution, $distanceMatched, $distanceDetail] = $this->scoreDistance(
            $driver,
            $context,
        );
        $factors[] = $this->factor(
            'distance',
            'Distance',
            $distanceMatched,
            $distanceContribution,
            self::WEIGHT_DISTANCE,
            $distanceDetail,
        );

        [$typeContribution, $typeMatched, $typeDetail] = $this->scoreVehicleTypeMatch(
            $vehicle,
            $jobOrder,
        );
        $factors[] = $this->factor(
            'vehicle_type_match',
            'Vehicle Type Match',
            $typeMatched,
            $typeContribution,
            self::WEIGHT_VEHICLE_TYPE,
            $typeDetail,
        );

        [$scheduleContribution, $scheduleMatched, $scheduleDetail] = $this->scoreScheduleMatch(
            $driver,
            $vehicle,
            $jobOrder,
        );
        $factors[] = $this->factor(
            'schedule_match',
            'Schedule Match',
            $scheduleMatched,
            $scheduleContribution,
            self::WEIGHT_SCHEDULE,
            $scheduleDetail,
        );

        $score = array_sum(array_column($factors, 'contribution'));
        $score = min(self::SCORE_MAX, max(0, $score));

        $reasons = array_values(array_filter(array_map(
            fn (array $factor) => $factor['contribution'] > 0 ? $factor['detail'] : null,
            $factors,
        )));

        return [
            'score'   => $score,
            'factors' => $factors,
            'reasons' => $reasons,
        ];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreVehicleCapacityMatch(Vehicle $vehicle, ?float $requiredVolume): array
    {
        $capacity = $this->vehicleVolumeCapacity($vehicle);

        if ($requiredVolume === null || $requiredVolume <= 0 || $capacity === null || $capacity <= 0) {
            return [
                (int) round(self::WEIGHT_VEHICLE_CAPACITY * 0.5),
                false,
                'Capacity metadata unavailable; neutral capacity match score applied.',
            ];
        }

        $utilization = min(1, $requiredVolume / $capacity);
        $contribution = (int) round(self::WEIGHT_VEHICLE_CAPACITY * min(1, $utilization / 0.85));
        $contribution = max(0, min(self::WEIGHT_VEHICLE_CAPACITY, $contribution));
        $unused = round($capacity - $requiredVolume, 2);
        $matched = $utilization >= 0.75;

        $detail = $matched
            ? sprintf('Load fits with %.2f m³ unused — strong capacity match.', $unused)
            : sprintf('Load fits but leaves %.2f m³ unused — oversized for this job.', $unused);

        return [$contribution, $matched, $detail];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreDriverAvailability(Driver $driver): array
    {
        if ($this->driverAvailability->isAdminUnavailable($driver)) {
            return [
                (int) round(self::WEIGHT_DRIVER_AVAILABILITY * 0.4),
                false,
                'Driver is marked offline by admin.',
            ];
        }

        return [
            self::WEIGHT_DRIVER_AVAILABILITY,
            true,
            'Driver is available with no blocking active assignments.',
        ];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreLoadEfficiency(Vehicle $vehicle, ?float $requiredVolume): array
    {
        $capacity = $this->vehicleVolumeCapacity($vehicle);

        if ($requiredVolume === null || $requiredVolume <= 0 || $capacity === null || $capacity <= 0) {
            return [
                (int) round(self::WEIGHT_LOAD_EFFICIENCY * 0.5),
                false,
                'Load efficiency unavailable — neutral score applied.',
            ];
        }

        $utilization = min(1, $requiredVolume / $capacity);
        $contribution = (int) round(self::WEIGHT_LOAD_EFFICIENCY * min(1, $utilization / 0.9));
        $contribution = max(0, min(self::WEIGHT_LOAD_EFFICIENCY, $contribution));
        $percent = (int) round($utilization * 100);
        $matched = $utilization >= 0.75;

        $detail = $utilization >= 0.85
            ? "Excellent utilization at {$percent}% of vehicle capacity."
            : ($utilization < 0.55
                ? "Low utilization at {$percent}% — vehicle is oversized for this load."
                : "Load uses {$percent}% of vehicle capacity.");

        return [$contribution, $matched, $detail];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreVehicleTypeMatch(Vehicle $vehicle, JobOrder $jobOrder): array
    {
        $report = VehicleTypeMatcher::evaluate($vehicle, $jobOrder);

        if ($report['matched']) {
            return [
                self::WEIGHT_VEHICLE_TYPE,
                true,
                'Vehicle type exactly matches the job requirement.',
            ];
        }

        $requiredWheel = VehicleTypeMatcher::normalize($jobOrder->preferredVehicleType?->wheel_type);
        $vehicleWheel = VehicleTypeMatcher::normalize($vehicle->vehicleType?->wheel_type);

        if ($requiredWheel !== null && $vehicleWheel !== null && VehicleTypeMatcher::equals($requiredWheel, $vehicleWheel)) {
            $partial = (int) round(self::WEIGHT_VEHICLE_TYPE * 0.5);

            return [
                $partial,
                false,
                'Wheel type matches but vehicle category differs from the preferred type.',
            ];
        }

        return [
            0,
            false,
            'Vehicle type does not match the job requirement.',
        ];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreScheduleMatch(Driver $driver, Vehicle $vehicle, JobOrder $jobOrder): array
    {
        $driverConflict = AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder);
        $vehicleConflict = AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder);

        if (! $driverConflict && ! $vehicleConflict) {
            return [
                self::WEIGHT_SCHEDULE,
                true,
                'Driver and vehicle schedules do not conflict with this job window.',
            ];
        }

        if ($driverConflict && $vehicleConflict) {
            return [
                0,
                false,
                'Driver and vehicle both have schedule conflicts with this job window.',
            ];
        }

        return [
            (int) round(self::WEIGHT_SCHEDULE * 0.5),
            false,
            'Partial schedule overlap detected for the driver or vehicle.',
        ];
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function scoreDistance(Driver $driver, array $context): array
    {
        $reference = $context['reference_coords'] ?? null;
        $location = $context['latest_locations'][$driver->id] ?? null;

        if (! $reference || ! $location) {
            return [
                (int) round(self::WEIGHT_DISTANCE * 0.5),
                false,
                'Distance unavailable (missing driver GPS or job coordinates).',
            ];
        }

        $distanceKm = $this->haversineKm(
            (float) $location->latitude,
            (float) $location->longitude,
            $reference['lat'],
            $reference['lng'],
        );

        $contribution = (int) round(self::WEIGHT_DISTANCE * max(0, 1 - min(1, $distanceKm / 80)));
        $contribution = max(0, min(self::WEIGHT_DISTANCE, $contribution));
        $matched = $distanceKm <= 25;

        $referenceLabel = match ($reference['source'] ?? '') {
            'pickup' => 'pickup',
            'delivery_zone' => 'delivery zone',
            default => 'job area',
        };

        $detail = sprintf(
            'Driver last known position is %.1f km from the %s.',
            $distanceKm,
            $referenceLabel,
        );

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
        return VehicleVolumeResolver::meetsRequired($vehicle, $requiredVolume)['pass'];
    }

    private function vehicleVolumeCapacity(Vehicle $vehicle): ?float
    {
        return VehicleVolumeResolver::resolve($vehicle)['value_m3'];
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
        return VehicleTypeMatcher::evaluate($vehicle, $jobOrder)['matched'];
    }

    private function normalizeVehicleTypeName(?string $value): ?string
    {
        return VehicleTypeMatcher::normalize($value);
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
