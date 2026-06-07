<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $roles = [
            'admin',
            'dispatcher',
            'manager',
            'driver',
            'customer',
        ];

        foreach ($roles as $roleName) {
            Role::firstOrCreate(['name' => $roleName]);
        }

        $adminRole = Role::where('name', 'admin')->first();

        User::updateOrCreate(
            ['email' => 'admin@deliverex.com'],
            [
                'role_id' => $adminRole?->id,
                'name' => 'Maria Santos',
                'password' => Hash::make('admin123'),
                'status' => 'active',
            ]
        );

        $customerRole = Role::where('name', 'customer')->first();
        User::updateOrCreate(
            ['email' => 'customer@deliverex.com'],
            [
                'role_id' => $customerRole?->id,
                'name' => 'Demo Customer',
                'password' => Hash::make('customer123'),
                'status' => 'active',
            ]
        );

        $dispatcherRole = Role::where('name', 'dispatcher')->first();
        User::updateOrCreate(
            ['email' => 'dispatcher@deliverex.com'],
            [
                'role_id' => $dispatcherRole?->id,
                'name' => 'Juan Dela Cruz',
                'password' => Hash::make('dispatcher123'),
                'status' => 'active',
            ]
        );

        $managerRole = Role::where('name', 'manager')->first();
        User::updateOrCreate(
            ['email' => 'manager@deliverex.com'],
            [
                'role_id' => $managerRole?->id,
                'name' => 'Demo Manager',
                'password' => Hash::make('manager123'),
                'status' => 'active',
            ]
        );

        $driverRole = Role::where('name', 'driver')->first();
        User::updateOrCreate(
            ['email' => 'driver@deliverex.ph'],
            [
                'role_id' => $driverRole?->id,
                'name' => 'Demo Driver',
                'password' => Hash::make('driver123'),
                'status' => 'active',
            ]
        );

        $this->call([
            VehicleTypeSeeder::class,
            MaterialMasterSeeder::class,
            ClientMasterSeeder::class,
            QuarryMasterSeeder::class,
            ClientPreferenceSeeder::class,
            VehicleMasterSeeder::class,
            DriverMasterSeeder::class,
            DriverVehicleAssignmentSeeder::class,
        ]);
    }
}
