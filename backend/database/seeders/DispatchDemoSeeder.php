<?php

namespace Database\Seeders;

use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds guaranteed-available demo drivers, vehicles, and pending job orders
 * so the Best-Fit panel always has valid recommendations for dispatcher demos.
 *
 * All operations are idempotent — safe to run after every fresh seed.
 */
class DispatchDemoSeeder extends Seeder
{
    public function run(): void
    {
        $driverRole = Role::where('name', 'driver')->first();
        $dispatcher = User::where('email', 'dispatcher@deliverex.com')->first();

        // ── Demo driver accounts ─────────────────────────────────────────────
        $driverDefs = [
            [
                'email'   => 'driver2@deliverex.ph',
                'name'    => 'Rodrigo Delos Reyes',
                'license' => 'LIC-DEMO-0002',
            ],
            [
                'email'   => 'driver3@deliverex.ph',
                'name'    => 'Carlo Mendoza',
                'license' => 'LIC-DEMO-0003',
            ],
            [
                'email'   => 'driver4@deliverex.ph',
                'name'    => 'Lito Villanueva',
                'license' => 'LIC-DEMO-0004',
            ],
        ];

        foreach ($driverDefs as $def) {
            $user = User::updateOrCreate(
                ['email' => $def['email']],
                [
                    'role_id'  => $driverRole?->id,
                    'name'     => $def['name'],
                    'password' => Hash::make('driver123'),
                    'status'   => 'active',
                ]
            );

            Driver::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'license_no'   => $def['license'],
                    'availability' => 'available',
                ]
            );

            // If the driver profile already exists, ensure it is available for demo.
            Driver::where('user_id', $user->id)
                ->where('availability', '!=', 'available')
                ->whereNull('current_assignment_id')
                ->update(['availability' => 'available']);
        }

        // ── Demo vehicles (never consumed by DemoDataSeeder) ─────────────────
        // Plate numbers are prefixed DX-DEMO- to avoid any clash with existing fleet.
        $vehicleDefs = [
            [
                'plate_no'      => 'DX-DEMO-001',
                'type'          => 'Dump Truck',
                'capacity'      => '10T',
                'max_weight_kg' => 10000.00,
                'max_volume_m3' => null,
                'status'        => 'available',
            ],
            [
                'plate_no'      => 'DX-DEMO-002',
                'type'          => 'Flatbed',
                'capacity'      => '8T',
                'max_weight_kg' => 8000.00,
                'max_volume_m3' => null,
                'status'        => 'available',
            ],
            [
                'plate_no'      => 'DX-DEMO-003',
                'type'          => 'Cargo Van',
                'capacity'      => '3T',
                'max_weight_kg' => 3000.00,
                'max_volume_m3' => null,
                'status'        => 'available',
            ],
        ];

        foreach ($vehicleDefs as $v) {
            Vehicle::updateOrCreate(
                ['plate_no' => $v['plate_no']],
                $v
            );
        }

        // ── Pending demo job orders ───────────────────────────────────────────
        // Only created if they do not already exist (tracked by tracking_code).
        // Each job is crafted so Best-Fit scores the matching demo vehicle highest.
        if (! $dispatcher) {
            return;
        }

        $customer = User::where('email', 'customer@deliverex.com')->first();

        $jobDefs = [
            [
                // Matches DX-DEMO-001 (Dump Truck 10T) — weight utilisation ~85 %
                'tracking_code'             => 'DEMO-DUMP-001',
                'customer_name'             => 'Santos Construction Inc.',
                'customer_email'            => 'santos@construction.ph',
                'customer_contact'          => '09171234567',
                'pickup_location'           => 'Caloocan City Depot',
                'dropoff_location'          => 'Malolos Bulacan Job Site',
                'vehicle_type_required'     => 'Dump Truck',
                'vehicle_capacity_required' => '10T',
                'weight_kg'                 => 8500.00,
                'volume_m3'                 => null,
                'priority'                  => 'high',
                'scheduled_start'           => now()->addHours(3),
                'scheduled_end'             => now()->addHours(7),
                'status'                    => 'pending',
                'job_requirements'          => 'Construction aggregates delivery. Driver must hold valid LTFRB permit.',
            ],
            [
                // Matches DX-DEMO-002 (Flatbed 8T) — weight utilisation 75 %
                'tracking_code'             => 'DEMO-FLAT-001',
                'customer_name'             => 'PH Steel Fabricators',
                'customer_email'            => 'ops@phsteel.ph',
                'customer_contact'          => '09289876543',
                'pickup_location'           => 'Valenzuela Industrial Zone',
                'dropoff_location'          => 'Cavite Export Processing Zone',
                'vehicle_type_required'     => 'Flatbed',
                'vehicle_capacity_required' => '8T',
                'weight_kg'                 => 6000.00,
                'volume_m3'                 => null,
                'priority'                  => 'normal',
                'scheduled_start'           => now()->addHours(5),
                'scheduled_end'             => now()->addHours(10),
                'status'                    => 'pending',
                'job_requirements'          => 'Steel beam transport. Secure load with ratchet straps before departure.',
            ],
            [
                // Matches any available vehicle — good for showing general Best-Fit scoring
                'tracking_code'             => 'DEMO-GEN-001',
                'customer_name'             => 'Reyes Trading Co.',
                'customer_email'            => 'reyes@trading.ph',
                'customer_contact'          => '09151122334',
                'pickup_location'           => 'Pasig Warehouse District',
                'dropoff_location'          => 'Laguna Distribution Hub, Sta. Rosa',
                'vehicle_type_required'     => null,
                'vehicle_capacity_required' => null,
                'weight_kg'                 => 1500.00,
                'volume_m3'                 => null,
                'priority'                  => 'urgent',
                'scheduled_start'           => now()->addHour(),
                'scheduled_end'             => now()->addHours(4),
                'status'                    => 'pending',
                'job_requirements'          => 'Mixed dry goods. Urgent delivery — time-sensitive consignment.',
            ],
        ];

        foreach ($jobDefs as $job) {
            JobOrder::firstOrCreate(
                ['tracking_code' => $job['tracking_code']],
                array_merge($job, [
                    'created_by'       => $dispatcher->id,
                    'customer_user_id' => $customer?->id,
                ])
            );
        }
    }
}
