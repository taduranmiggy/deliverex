<?php

namespace Database\Seeders;

use Database\Seeders\DemoDataSeeder;
use App\Models\Driver;
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

        $driverRole = Role::where('name', 'driver')->first();
        $driverUser = User::updateOrCreate(
            ['email' => 'driver@deliverex.ph'],
            [
                'role_id' => $driverRole?->id,
                'name' => 'Demo Driver',
                'password' => Hash::make('driver123'),
                'status' => 'active',
            ]
        );

        Driver::firstOrCreate(
            ['user_id' => $driverUser->id],
            [
                'license_no' => 'LIC-DEMO-0001',
                'availability' => 'available',
            ]
        );

        $this->call([
            DemoDataSeeder::class,
            DispatchDemoSeeder::class,
        ]);
    }
}
