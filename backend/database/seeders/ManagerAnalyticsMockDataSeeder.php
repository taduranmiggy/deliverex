<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\DeliveryDelayReport;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\DeliveryIssueReport;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Fleet\AssignmentResourceSyncService;
use App\Support\DeliveryStatus;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ManagerAnalyticsMockDataSeeder extends Seeder
{
    private const MAX_ACTIVE_MOCK_ASSIGNMENTS = 6;

    private const ACTIVE_STATUSES = ['assigned', 'in_progress', 'arrived'];

    private const RESERVED_DRIVER_EMAILS = [
        'driver@deliverex.ph',
        'driver2@deliverex.ph',
        'driver3@deliverex.ph',
        'driver4@deliverex.ph',
    ];

    public function run(): void
    {
        $dispatcher = User::query()->where('email', 'dispatcher@deliverex.com')->first();
        $manager = User::query()->where('email', 'manager@deliverex.com')->first();
        $customer = User::query()->where('email', 'customer@deliverex.com')->first();
        $drivers = Driver::query()->with('user')->get();
        $vehicles = Vehicle::query()->get();
        $companies = Company::query()->get();

        if (! $dispatcher || $drivers->isEmpty() || $vehicles->isEmpty() || $companies->isEmpty()) {
            $this->command->warn('Skipping analytics mock data because required seed data is not available.');

            return;
        }

        $existingMockCount = JobOrder::query()
            ->where('tracking_code', 'like', 'MOCK-%')
            ->count();

        if ($existingMockCount > 0) {
            $normalized = $this->normalizeExistingMockData();
            $this->command->info(
                "Analytics mock data already present; normalized {$normalized['completed']} stale assignment(s), "
                ."kept {$normalized['active']} uniquely resourced active assignment(s), and rescheduled "
                ."{$normalized['pending']} pending job(s)."
            );

            return;
        }

        [$activeDrivers, $activeVehicles] = $this->selectActiveResources($drivers, $vehicles);
        $activeLimit = min($activeDrivers->count(), $activeVehicles->count());
        $priorityWeights = ['low' => 0.15, 'normal' => 0.45, 'high' => 0.25, 'urgent' => 0.15];
        $vehicleTypes = ['Dump Truck', 'Flatbed', 'Cargo Van', 'Mixer Truck', 'Box Truck'];
        $vehicleCaps = ['5T', '8T', '10T', '12T', '15T'];

        $customers = [
            'Apex Construction', 'BrightStone Logistics', 'Metro Civil Works', 'Northwind Supply',
            'Crestline Builders', 'Harbor Freight', 'Prime Materials', 'BluePeak Trading',
            'Sunline Industries', 'Riverstone Hauling', 'North Harbor Dev', 'Cedar Transport',
            'Island Builders', 'Skyline Infra', 'Atlas Deliveries', 'Pinnacle Logistics',
        ];

        $pickupAreas = [
            'Caloocan City', 'Makati CBD', 'Quezon City', 'Pasig City', 'Taguig City', 'Manila', 'Cebu City',
            'Davao City', 'Bacolod', 'Iloilo City', 'Cavite', 'Bulacan', 'Laguna', 'Pampanga', 'Pangasinan'
        ];

        $dropoffAreas = [
            'Malolos Bulacan', 'Batangas Port', 'Cavite Export Zone', 'Sta. Rosa Laguna', 'Bacoor Cavite',
            'Muntinlupa', 'Pasay City', 'Clark Freeport', 'Subic Bay', 'Lipa Batangas', 'Antipolo', 'San Fernando Pampanga'
        ];

        $delayReasons = array_keys(DeliveryDelayReport::REASONS);
        $issueTypes = ['late_arrival', 'damaged_load', 'customer_not_available', 'route_issue', 'vehicle_issue', 'paperwork_issue'];

        $now = now();
        $createdCount = 0;

        DB::beginTransaction();

        try {
            for ($i = 0; $i < 1200; $i++) {
                $createdAt = $now->copy()->subDays(rand(1, 90))->subHours(rand(0, 23))->subMinutes(rand(0, 59));
                $status = $this->pickStatus($i, $activeLimit);
                [$scheduledStart, $scheduledEnd] = $this->scheduleForStatus($status, $createdAt, $i);
                $priority = Arr::random(array_keys($priorityWeights));
                $company = $companies->random();
                $customerName = $customers[array_rand($customers)] . ' ' . ($i % 7 + 1);
                $trackingCode = 'MOCK-' . str_pad((string) ($i + 1), 5, '0', STR_PAD_LEFT);

                $jobOrder = JobOrder::withoutEvents(fn () => JobOrder::create([
                    'created_by' => $dispatcher->id,
                    'customer_user_id' => $customer?->id,
                    'company_id' => $company->id,
                    'tracking_code' => $trackingCode,
                    'customer_name' => $customerName,
                    'customer_email' => strtolower(Str::slug($customerName)) . '@example.com',
                    'customer_contact' => '+63' . rand(900000000, 999999999),
                    'pickup_location' => $pickupAreas[array_rand($pickupAreas)] . ' - ' . $this->randomAddressSuffix(),
                    'dropoff_location' => $dropoffAreas[array_rand($dropoffAreas)] . ' - ' . $this->randomAddressSuffix(),
                    'job_requirements' => $this->randomRequirement($priority),
                    'vehicle_type_required' => $vehicleTypes[array_rand($vehicleTypes)],
                    'vehicle_capacity_required' => $vehicleCaps[array_rand($vehicleCaps)],
                    'status' => $status,
                    'priority' => $priority,
                    'scheduled_start' => $scheduledStart,
                    'scheduled_end' => $scheduledEnd,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt->copy()->addHours(rand(1, 12)),
                ]));

                if ($status !== 'pending') {
                    $isActive = in_array($status, self::ACTIVE_STATUSES, true);
                    $driver = $isActive ? $activeDrivers[$i] : $drivers->random();
                    $vehicle = $isActive ? $activeVehicles[$i] : $vehicles->random();
                    [$assignedAt, $startedAt, $completedAt] = $this->assignmentTimes(
                        $status,
                        $createdAt,
                        $scheduledStart,
                        $scheduledEnd,
                    );

                    $assignment = DispatchAssignment::create([
                        'job_order_id' => $jobOrder->id,
                        'driver_id' => $driver->id,
                        'vehicle_id' => $vehicle->id,
                        'assigned_by' => $dispatcher->id,
                        'status' => $status,
                        'assigned_at' => $assignedAt,
                        'started_at' => $startedAt,
                        'completed_at' => $completedAt,
                        'created_at' => $assignedAt,
                        'updated_at' => $completedAt ?? $startedAt ?? $assignedAt,
                    ]);

                    if ($status === 'completed' || ($isActive && rand(1, 10) <= 3)) {
                        $issueAt = $completedAt ?? $scheduledEnd->copy()->addMinutes(rand(-30, 90));
                        $issueAt = $this->clampPastDate($issueAt, $assignedAt);

                        DeliveryIssueReport::create([
                            'assignment_id' => $assignment->id,
                            'driver_id' => $driver->id,
                            'reported_by' => $manager?->id ?? $dispatcher->id,
                            'issue_type' => $issueTypes[array_rand($issueTypes)],
                            'notes' => 'Synthetic issue report for analytics testing.',
                            'created_at' => $issueAt,
                            'updated_at' => $issueAt,
                        ]);
                    }

                    if ($status === 'completed' || ($isActive && rand(1, 10) <= 2)) {
                        $delayAt = $completedAt ?? $scheduledEnd->copy()->addMinutes(rand(-30, 90));
                        $delayAt = $this->clampPastDate($delayAt, $assignedAt);

                        DeliveryDelayReport::create([
                            'job_order_id' => $jobOrder->id,
                            'assignment_id' => $assignment->id,
                            'driver_id' => $driver->id,
                            'reported_by' => $manager?->id ?? $dispatcher->id,
                            'delay_reason' => $delayReasons[array_rand($delayReasons)],
                            'delay_notes' => 'Synthetic delay log used for manager analytics.',
                            'created_at' => $delayAt,
                            'updated_at' => $delayAt,
                        ]);
                    }
                }

                $createdCount++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $reconcile = app(AssignmentResourceSyncService::class)->reconcileAll('analytics_mock_seed');

        $this->command->info(
            "Generated {$createdCount} mock job orders for analytics testing with {$activeLimit} active assignment(s). "
            ."Fleet reconciliation applied {$reconcile['driver_changes']} driver and {$reconcile['vehicle_changes']} vehicle change(s)."
        );
    }

    private function pickStatus(int $index, int $activeLimit): string
    {
        if ($index < $activeLimit) {
            return self::ACTIVE_STATUSES[$index % count(self::ACTIVE_STATUSES)];
        }

        $roll = rand(1, 100);

        if ($roll <= 20) {
            return 'pending';
        }

        if ($roll <= 85) {
            return 'completed';
        }

        return 'cancelled';
    }

    private function selectActiveResources($drivers, $vehicles): array
    {
        $blockingStatuses = DeliveryStatus::availabilityBlockingRawValues();

        $eligibleDrivers = $drivers
            ->filter(function (Driver $driver) use ($blockingStatuses): bool {
                if ($this->isReservedDriver($driver)
                    || in_array($driver->status, ['inactive', 'suspended', 'archived'], true)
                    || $driver->availability === 'offline') {
                    return false;
                }

                return ! $driver->assignments()
                    ->whereIn('status', $blockingStatuses)
                    ->exists();
            })
            ->shuffle()
            ->values();

        $eligibleVehicles = $vehicles
            ->filter(function (Vehicle $vehicle) use ($blockingStatuses): bool {
                if ($this->isReservedVehicle($vehicle)
                    || in_array($vehicle->status, ['maintenance', 'unavailable', 'inactive', 'archived'], true)) {
                    return false;
                }

                return ! $vehicle->assignments()
                    ->whereIn('status', $blockingStatuses)
                    ->exists();
            })
            ->shuffle()
            ->values();

        // Always leave at least one ordinary resource free in addition to the
        // dedicated DX-DEMO fleet used by the dispatcher exhibit.
        $activeLimit = min(
            self::MAX_ACTIVE_MOCK_ASSIGNMENTS,
            max(0, $eligibleDrivers->count() - 1),
            max(0, $eligibleVehicles->count() - 1),
        );

        return [
            $eligibleDrivers->take($activeLimit)->values(),
            $eligibleVehicles->take($activeLimit)->values(),
        ];
    }

    /** @return array{0: \Illuminate\Support\Carbon, 1: \Illuminate\Support\Carbon} */
    private function scheduleForStatus(string $status, \Illuminate\Support\Carbon $createdAt, int $index): array
    {
        if ($status === 'assigned') {
            $start = now()->addHours(2 + $index);

            return [$start, $start->copy()->addHours(4)];
        }

        if ($status === 'in_progress') {
            return [now()->subHour(), now()->addHours(3)];
        }

        if ($status === 'arrived') {
            return [now()->subHours(4), now()->addHour()];
        }

        if ($status === 'pending') {
            $start = now()
                ->addDays(1 + ($index % 21))
                ->addHours($index % 8);

            return [$start, $start->copy()->addHours(rand(2, 8))];
        }

        // Completed/cancelled analytics history must be entirely in the past.
        $start = $createdAt->copy()->addHours(rand(1, 12));

        return [$start, $start->copy()->addHours(rand(2, 8))];
    }

    /** @return array{0: \Illuminate\Support\Carbon, 1: ?\Illuminate\Support\Carbon, 2: ?\Illuminate\Support\Carbon} */
    private function assignmentTimes(
        string $status,
        \Illuminate\Support\Carbon $createdAt,
        \Illuminate\Support\Carbon $scheduledStart,
        \Illuminate\Support\Carbon $scheduledEnd,
    ): array {
        if ($status === 'assigned') {
            return [now()->subMinutes(30), null, null];
        }

        if (in_array($status, ['in_progress', 'arrived'], true)) {
            return [
                $scheduledStart->copy()->subHour(),
                $scheduledStart->copy(),
                null,
            ];
        }

        $assignedAt = $this->clampPastDate($createdAt->copy()->addHours(rand(1, 6)));

        if ($status === 'cancelled') {
            return [$assignedAt, null, null];
        }

        $startedAt = $this->clampDateAfter(
            $assignedAt->copy()->addMinutes(rand(10, 90)),
            $assignedAt,
        );
        $completedAt = $this->clampDateAfter(
            $this->clampPastDate($scheduledEnd->copy()->addMinutes(rand(-20, 30))),
            $startedAt,
        );

        return [$assignedAt, $startedAt, $completedAt];
    }

    /** @return array{active:int,completed:int,pending:int} */
    private function normalizeExistingMockData(): array
    {
        $blockingStatuses = DeliveryStatus::availabilityBlockingRawValues();
        $externalDriverIds = DispatchAssignment::query()
            ->whereIn('status', $blockingStatuses)
            ->whereDoesntHave('jobOrder', fn ($q) => $q->where('tracking_code', 'like', 'MOCK-%'))
            ->whereNotNull('driver_id')
            ->pluck('driver_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $externalVehicleIds = DispatchAssignment::query()
            ->whereIn('status', $blockingStatuses)
            ->whereDoesntHave('jobOrder', fn ($q) => $q->where('tracking_code', 'like', 'MOCK-%'))
            ->whereNotNull('vehicle_id')
            ->pluck('vehicle_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $activeAssignments = DispatchAssignment::query()
            ->with(['jobOrder', 'driver.user', 'vehicle'])
            ->whereIn('status', $blockingStatuses)
            ->whereHas('jobOrder', fn ($q) => $q->where('tracking_code', 'like', 'MOCK-%'))
            ->orderByDesc('id')
            ->get();

        $usedDriverIds = [];
        $usedVehicleIds = [];
        $keptActive = 0;
        $completed = 0;

        foreach ($activeAssignments as $assignment) {
            $driverId = (int) $assignment->driver_id;
            $vehicleId = (int) $assignment->vehicle_id;
            $driver = $assignment->driver;
            $vehicle = $assignment->vehicle;
            $jobOrder = $assignment->jobOrder;

            $canRemainActive = $keptActive < self::MAX_ACTIVE_MOCK_ASSIGNMENTS
                && $driver
                && $vehicle
                && $jobOrder
                && ! isset($usedDriverIds[$driverId])
                && ! isset($usedVehicleIds[$vehicleId])
                && ! in_array($driverId, $externalDriverIds, true)
                && ! in_array($vehicleId, $externalVehicleIds, true)
                && ! $this->isReservedDriver($driver)
                && ! $this->isReservedVehicle($vehicle)
                && ! in_array($driver->status, ['inactive', 'suspended', 'archived'], true)
                && $driver->availability !== 'offline'
                && ! in_array($vehicle->status, ['maintenance', 'unavailable', 'inactive', 'archived'], true);

            if ($canRemainActive) {
                $status = self::ACTIVE_STATUSES[$keptActive % count(self::ACTIVE_STATUSES)];
                [$scheduledStart, $scheduledEnd] = $this->scheduleForStatus($status, now()->subDay(), $keptActive);
                [$assignedAt, $startedAt] = $this->assignmentTimes(
                    $status,
                    now()->subDay(),
                    $scheduledStart,
                    $scheduledEnd,
                );

                JobOrder::withoutEvents(fn () => $jobOrder->update([
                    'status' => $status,
                    'scheduled_start' => $scheduledStart,
                    'scheduled_end' => $scheduledEnd,
                ]));
                $assignment->update([
                    'status' => $status,
                    'assigned_at' => $assignedAt,
                    'started_at' => $startedAt,
                    'completed_at' => null,
                ]);

                $usedDriverIds[$driverId] = true;
                $usedVehicleIds[$vehicleId] = true;
                $keptActive++;

                continue;
            }

            $completedAt = $jobOrder?->scheduled_end;
            if (! $completedAt || $completedAt->isFuture()) {
                $completedAt = now()->subMinutes(5);
            }

            $assignment->update([
                'status' => DeliveryStatus::COMPLETED,
                'completed_at' => $completedAt,
            ]);

            if ($jobOrder && ! $jobOrder->assignments()->whereIn('status', $blockingStatuses)->exists()) {
                JobOrder::withoutEvents(fn () => $jobOrder->update(['status' => DeliveryStatus::COMPLETED]));
            }

            $completed++;
        }

        JobOrder::query()
            ->where('tracking_code', 'like', 'MOCK-%')
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->whereDoesntHave('assignments', fn ($q) => $q->whereIn('status', $blockingStatuses))
            ->update(['status' => DeliveryStatus::COMPLETED]);

        $pendingRescheduled = 0;
        JobOrder::query()
            ->where('tracking_code', 'like', 'MOCK-%')
            ->where('status', 'pending')
            ->orderBy('id')
            ->each(function (JobOrder $jobOrder) use (&$pendingRescheduled) {
                if ($jobOrder->scheduled_start
                    && $jobOrder->scheduled_end
                    && $jobOrder->scheduled_start->isFuture()
                    && $jobOrder->scheduled_end->isFuture()) {
                    return;
                }

                [$scheduledStart, $scheduledEnd] = $this->scheduleForStatus(
                    'pending',
                    now()->subDay(),
                    $pendingRescheduled,
                );

                JobOrder::withoutEvents(fn () => $jobOrder->update([
                    'scheduled_start' => $scheduledStart,
                    'scheduled_end' => $scheduledEnd,
                ]));
                $pendingRescheduled++;
            });

        app(AssignmentResourceSyncService::class)->reconcileAll('analytics_mock_seed_normalization');

        return [
            'active' => $keptActive,
            'completed' => $completed,
            'pending' => $pendingRescheduled,
        ];
    }

    private function isReservedDriver(Driver $driver): bool
    {
        $email = strtolower((string) $driver->user?->email);

        return in_array($email, self::RESERVED_DRIVER_EMAILS, true);
    }

    private function isReservedVehicle(Vehicle $vehicle): bool
    {
        return str_starts_with((string) $vehicle->plate_no, 'DX-DEMO-');
    }

    private function randomRequirement(string $priority): string
    {
        $templates = [
            'Fragile cargo; use padded straps and avoid hard braking.',
            'Need liftgate assistance at drop-off location.',
            'Urgent consigment; maintain temperature control from pickup to delivery.',
            'Hazardous material handling required; follow site safety protocol.',
            'Prioritize pre-booked dock slot at destination.',
            'Call recipient 30 minutes before arrival for gate access.',
        ];

        return $priority === 'urgent' ? $templates[array_rand($templates)] : $templates[array_rand($templates)];
    }

    private function randomAddressSuffix(): string
    {
        $suffixes = ['Block 3', 'Lot 8', 'Warehouse B', 'Gate 2', 'North Wing', 'South Yard', 'Terminal 1'];

        return $suffixes[array_rand($suffixes)];
    }

    private function clampPastDate(
        \Illuminate\Support\Carbon $date,
        ?\Illuminate\Support\Carbon $minDate = null
    ): \Illuminate\Support\Carbon {
        $now = now();
        if ($date->gt($now)) {
            $date = $now->copy()->subMinutes(rand(5, 45));
        }

        if ($minDate && $date->lt($minDate)) {
            $date = $minDate->copy()->addMinutes(rand(10, 90));
            if ($date->gt($now)) {
                $date = $now->copy()->subMinutes(rand(5, 45));
            }
        }

        return $date;
    }

    private function clampDateAfter(
        \Illuminate\Support\Carbon $date,
        \Illuminate\Support\Carbon $after
    ): \Illuminate\Support\Carbon {
        if ($date->lt($after)) {
            $date = $after->copy()->addMinutes(rand(10, 90));
        }

        return $date;
    }
}
