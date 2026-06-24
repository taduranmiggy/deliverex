<?php

namespace Database\Seeders;

use App\Models\AssignmentAuditTrail;
use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryDelayReport;
use App\Models\DeliveryIssueReport;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\TrackingLog;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::query()->pluck('id', 'name');

        User::updateOrCreate(
            ['email' => 'dispatcher@deliverex.com'],
            [
                'role_id' => $roles['dispatcher'] ?? null,
                'name' => 'Juan Dela Cruz',
                'password' => Hash::make('dispatcher123'),
                'status' => 'active',
            ]
        );

        User::updateOrCreate(
            ['email' => 'manager@deliverex.com'],
            [
                'role_id' => $roles['manager'] ?? null,
                'name' => 'Demo Manager',
                'password' => Hash::make('manager123'),
                'status' => 'active',
            ]
        );

        if (JobOrder::query()->exists()) {
            $this->linkDemoCustomerJobs();

            return;
        }

        $dispatcher = User::where('email', 'dispatcher@deliverex.com')->first();

        $driverUsers = User::factory(5)->create([
            'role_id' => $roles['driver'] ?? null,
            'status' => 'active',
        ]);

        $drivers = $driverUsers->map(function (User $user, int $index) {
            return Driver::create([
                'user_id' => $user->id,
                'license_no' => 'LIC-' . str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT),
                'availability' => 'available',
            ]);
        });

        $vehicles = collect([
            ['plate_no' => 'ABC-1234', 'type' => 'Isuzu Giga Dump Truck', 'capacity' => '15T'],
            ['plate_no' => 'DX-1002', 'type' => 'Flatbed', 'capacity' => '8T'],
            ['plate_no' => 'DX-1003', 'type' => 'Cargo Van', 'capacity' => '3T'],
            ['plate_no' => 'DX-1004', 'type' => 'Mixer Truck', 'capacity' => '12T'],
            ['plate_no' => 'DX-1005', 'type' => 'Box Truck', 'capacity' => '5T'],
        ])->map(fn ($vehicle) => Vehicle::create(array_merge($vehicle, ['status' => 'available'])));

        $jobOrders = JobOrder::factory()->count(6)->create([
            'created_by' => $dispatcher->id,
            'status' => 'pending',
        ]);

        $jobOrders->each(function (JobOrder $jobOrder, int $index) use ($drivers, $vehicles, $dispatcher) {
            if ($index < 2) {
                $driver = $drivers[$index % $drivers->count()];
                $vehicle = $vehicles[$index % $vehicles->count()];

                $assignment = DispatchAssignment::create([
                    'job_order_id' => $jobOrder->id,
                    'driver_id' => $driver->id,
                    'vehicle_id' => $vehicle->id,
                    'assigned_by' => $dispatcher->id,
                    'status' => $index % 2 === 0 ? 'in_progress' : 'assigned',
                    'assigned_at' => now()->subHours(4 - $index),
                ]);

                DeliveryStatusLog::create([
                    'assignment_id' => $assignment->id,
                    'status' => $assignment->status,
                    'notes' => 'Demo status update',
                    'created_at' => now()->subHours(3 - $index),
                ]);

                TrackingLog::create([
                    'assignment_id' => $assignment->id,
                    'latitude' => 14.5995 + ($index * 0.01),
                    'longitude' => 120.9842 + ($index * 0.01),
                    'captured_at' => now()->subMinutes(15 * ($index + 1)),
                ]);

                $driver->update(['availability' => 'busy']);
                $vehicle->update(['status' => 'assigned']);
                $jobOrder->update(['status' => $assignment->status]);
            } elseif ($index < 4) {
                $this->seedCompletedAssignment($jobOrder, $drivers[$index], $vehicles[$index], $dispatcher, $index === 2);
            }
        });

        Vehicle::where('plate_no', 'DX-1005')->update(['status' => 'maintenance']);

        $this->linkDemoCustomerJobs();
    }

    private function seedCompletedAssignment(
        JobOrder $jobOrder,
        Driver $driver,
        Vehicle $vehicle,
        User $dispatcher,
        bool $onTime,
    ): void {
        $scheduledEnd = now()->subDays(3)->addHours($onTime ? 4 : -2);
        $startedAt    = now()->subDays(3);
        $completedAt  = $onTime ? $scheduledEnd->copy()->subHour() : $scheduledEnd->copy()->addHours(2);

        $jobOrder->update([
            'status'          => 'completed',
            'scheduled_start' => $startedAt->copy()->subHour(),
            'scheduled_end'   => $scheduledEnd,
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id'    => $jobOrder->id,
            'driver_id'       => $driver->id,
            'vehicle_id'      => $vehicle->id,
            'assigned_by'     => $dispatcher->id,
            'status'          => 'completed',
            'assigned_at'     => $startedAt->copy()->subHours(2),
            'started_at'      => $startedAt,
            'completed_at'    => $completedAt,
            'pod_verified_at' => $onTime ? $completedAt->copy()->addMinutes(15) : null,
            'pod_verified_by' => $onTime ? $dispatcher->id : null,
        ]);

        if (! $onTime) {
            DeliveryCompletionProof::create([
                'job_order_id'   => $jobOrder->id,
                'assignment_id'  => $assignment->id,
                'driver_id'      => $driver->id,
                'reported_by'    => $driver->user_id,
                'proof_type'     => DeliveryCompletionProof::TYPE_RECEIPT_PHOTO,
                'receiver_name'  => 'Site Receiver',
                'delivery_notes' => 'Demo completion proof',
            ]);
        }

        AssignmentAuditTrail::create([
            'assignment_id'             => $assignment->id,
            'job_order_id'              => $jobOrder->id,
            'dispatcher_id'             => $dispatcher->id,
            'recommended_driver_id'     => $driver->id,
            'recommended_vehicle_id'    => $vehicle->id,
            'recommended_driver_name'   => $driver->user?->name ?? 'Demo Driver',
            'recommended_vehicle_plate' => $vehicle->plate_no,
            'assigned_driver_id'        => $driver->id,
            'assigned_vehicle_id'       => $vehicle->id,
            'assigned_driver_name'      => $driver->user?->name ?? 'Demo Driver',
            'assigned_vehicle_plate'    => $vehicle->plate_no,
            'is_override'               => ! $onTime,
            'override_reason'           => $onTime ? null : 'Client requested specific driver',
            'best_fit_score'            => $onTime ? 92.5 : 78.0,
            'best_fit_reasons'          => ['capacity_match', 'proximity'],
        ]);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status'        => 'completed',
            'notes'         => 'Demo completed delivery',
            'created_at'    => $completedAt,
        ]);

        if (! $onTime) {
            DeliveryDelayReport::create([
                'job_order_id'   => $jobOrder->id,
                'assignment_id'  => $assignment->id,
                'driver_id'      => $driver->id,
                'reported_by'    => $driver->user_id,
                'delay_reason'   => 'traffic_congestion',
                'delay_notes'    => 'Demo delay for KPI seeding',
            ]);

            DeliveryIssueReport::create([
                'assignment_id' => $assignment->id,
                'driver_id'     => $driver->id,
                'reported_by'   => $driver->user_id,
                'issue_type'    => 'other',
                'notes'         => 'Demo issue for exception rate KPI',
            ]);
        }

        $driver->update(['availability' => 'available']);
        $vehicle->update(['status' => 'available']);
    }

    /** Attach sample jobs to the demo customer account (runs on fresh demo or after migrations). */
    private function linkDemoCustomerJobs(): void
    {
        if (! Schema::hasColumn('job_orders', 'customer_user_id')) {
            return;
        }

        $customer = User::query()->where('email', 'customer@deliverex.com')->first();
        if (! $customer) {
            return;
        }

        JobOrder::query()
            ->whereNull('customer_user_id')
            ->orderBy('id')
            ->limit(3)
            ->update([
                'customer_user_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_contact' => $customer->phone ?: $customer->email,
            ]);
    }
}
