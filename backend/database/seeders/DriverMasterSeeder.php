<?php

namespace Database\Seeders;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\DriverVehicleAssignment;
use App\Models\User;
use Illuminate\Database\Seeder;

class DriverMasterSeeder extends Seeder
{
    public function run(): void
    {
        $drivers = [
            'Rubio, Bernie',
            'Wencislao, Joseph',
            'Garcia, John Michael',
            'Garcia, Oniel',
            'Magsaysay, Cindy Jun',
            'Ocampo, Israel John',
            'Mercado, Raymond Jr.',
            'Santos, Wrenz Tuazon',
            'Europa, Ar-jay',
            'David, Arman Joseph',
            'Punzalan, Russel',
            'Ocampo, Gil',
            'Gali, Edson',
            'Malit, Jaypee',
            'Cabahug, Raphael',
            'Dominguez, Raphael',
            'Henson, Christian Bernardo',
            'Cabahug, Ronick',
            'Ocampo, Enrile',
            'Dizon, Jayson',
            'Dizon, Gerald',
            'Miranda, Jinno',
            'Catipon, Nestor',
            'Garibay, Roman',
            'Escoto, Rafael',
            'Sumbay, Jonnel',
            'Mangune, Omar',
            'Pineda, Jordan',
            'Pineda, Jay Pe',
            'Villama, Christian',
            'Ramos, Christian M.',
            'Alcantara, Juan Carlo',
            'Peco, John Michael',
            'Santos, Franz Tuazon',
        ];

        $normalizedNames = collect($drivers)
            ->map(fn (string $name) => trim($name))
            ->values();

        $keptDriverIds = [];

        foreach ($drivers as $fullName) {
            // Use firstOrCreate so that re-seeding never overwrites an existing driver's
            // user_id linkage, license details, or other fields that may have been set
            // via Master Data management or account-generation.
            $driver = Driver::firstOrCreate(
                ['full_name' => trim($fullName)],
                [
                    'availability' => 'available',
                    'status'       => 'available',
                ]
            );
            $keptDriverIds[] = $driver->id;
        }

        $this->cleanupNonClientDrivers($keptDriverIds, $normalizedNames->all());
    }

    private function cleanupNonClientDrivers(array $keptDriverIds, array $clientDriverNames): void
    {
        $nonClientDrivers = Driver::query()
            ->with('user:id,email,role_id')
            ->whereNotIn('id', $keptDriverIds)
            ->get();

        foreach ($nonClientDrivers as $driver) {
            if (! $driver instanceof Driver) {
                continue;
            }

            $hasAssignments = DispatchAssignment::query()
                ->where('driver_id', $driver->id)
                ->exists();

            if ($hasAssignments) {
                $driver->update([
                    'status' => 'inactive',
                    'availability' => 'offline',
                ]);
                continue;
            }

            DriverVehicleAssignment::query()
                ->where('driver_id', $driver->id)
                ->delete();

            $userId = $driver->user_id;
            $driver->delete();

            if (! $userId) {
                continue;
            }

            $user = User::query()->find($userId);
            if (! $user) {
                continue;
            }

            $isClientDriverName = in_array(trim((string) $user->name), $clientDriverNames, true);
            $isProtectedDemoAccount = in_array(strtolower((string) $user->email), [
                'driver@deliverex.ph',
            ], true);

            if (! $isClientDriverName && ! $isProtectedDemoAccount) {
                $user->delete();
            }
        }
    }
}
