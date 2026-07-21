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
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ManagerAnalyticsMockDataSeeder extends Seeder
{
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

        $existingCount = JobOrder::query()->count();
        if ($existingCount >= 1200) {
            $this->command->info('Analytics mock data already present; skipping generation.');

            return;
        }

        $statuses = ['pending', 'assigned', 'in_progress', 'arrived', 'completed', 'cancelled'];
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
                $scheduledStart = $createdAt->copy()->addHours(rand(1, 24));
                if ($scheduledStart->isFuture()) {
                    $scheduledStart = now()->subHours(rand(0, 6));
                }
                $scheduledEnd = $scheduledStart->copy()->addHours(rand(2, 8));
                if ($scheduledEnd->isFuture()) {
                    $scheduledEnd = now()->copy()->subMinutes(rand(0, 120));
                    if ($scheduledEnd->lte($scheduledStart)) {
                        $scheduledEnd = $scheduledStart->copy()->addHours(1);
                    }
                }
                $status = $this->pickStatus($i, $createdAt);
                $priority = Arr::random(array_keys($priorityWeights));
                $company = $companies->random();
                $customerName = $customers[array_rand($customers)] . ' ' . ($i % 7 + 1);
                $trackingCode = 'MOCK-' . str_pad((string) ($i + 1), 5, '0', STR_PAD_LEFT);

                $jobOrder = JobOrder::create([
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
                ]);

                if (in_array($status, ['assigned', 'in_progress', 'arrived', 'completed'])) {
                    $driver = $drivers->random();
                    $vehicle = $vehicles->random();
                    $assignedAt = $createdAt->copy()->addHours(rand(1, 6));
                    $assignedAt = $this->clampPastDate($assignedAt);

                    $startedAt = $assignedAt->copy()->addMinutes(rand(10, 90));
                    $startedAt = $this->clampDateAfter($startedAt, $assignedAt);

                    $completedAt = null;
                    $assignmentStatus = 'assigned';

                    if ($status === 'completed') {
                        $completedAt = $scheduledEnd->copy()->addMinutes(rand(-20, 30));
                        $completedAt = $this->clampPastDate($completedAt);
                        $completedAt = $this->clampDateAfter($completedAt, $startedAt);
                        $assignmentStatus = 'completed';
                    } elseif ($status === 'arrived') {
                        $assignmentStatus = 'arrived';
                    } elseif ($status === 'in_progress') {
                        $assignmentStatus = 'in_progress';
                    }

                    $assignment = DispatchAssignment::create([
                        'job_order_id' => $jobOrder->id,
                        'driver_id' => $driver->id,
                        'vehicle_id' => $vehicle->id,
                        'assigned_by' => $dispatcher->id,
                        'status' => $assignmentStatus,
                        'assigned_at' => $assignedAt,
                        'started_at' => $startedAt,
                        'completed_at' => $completedAt,
                        'created_at' => $assignedAt,
                        'updated_at' => $completedAt ?? $startedAt,
                    ]);

                    if ($status === 'completed' || ($status !== 'pending' && rand(1, 10) <= 3)) {
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

                    if ($status === 'completed' || ($status !== 'pending' && rand(1, 10) <= 2)) {
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

        $this->command->info("Generated {$createdCount} mock job orders for analytics testing.");
    }

    private function pickStatus(int $index, $createdAt): string
    {
        $roll = rand(1, 100);

        if ($createdAt->lt(now()->subDays(90)) && $roll <= 45) {
            return 'completed';
        }

        if ($roll <= 20) {
            return 'pending';
        }

        if ($roll <= 45) {
            return 'assigned';
        }

        if ($roll <= 70) {
            return 'in_progress';
        }

        if ($roll <= 85) {
            return 'arrived';
        }

        return 'cancelled';
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
