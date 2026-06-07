<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\ClientQuarryVehiclePreference;
use App\Models\Quarry;
use App\Models\VehicleType;
use Illuminate\Database\Seeder;

class ClientPreferenceSeeder extends Seeder
{
    public function run(): void
    {
        $mappings = [
            ['client' => 'Acciona Philippines Inc.', 'quarry' => 'Dream Rock Resources Philippines, Inc.', 'vehicle_type' => ['Mini Dump', '6 Wheeler', 2, 4]],
            ['client' => 'China Road and Bridge Corp.', 'quarry' => 'PL Mercado Builders', 'vehicle_type' => ['Medium Dump', '6 Wheeler', 6, 8]],
            ['client' => 'DMCI Holdings, Inc.', 'quarry' => 'Rodrock and Aggregates Corporation', 'vehicle_type' => ['Trailer Dump', '10 Wheeler', 18, 22]],
            ['client' => 'EEI Corporation', 'quarry' => 'Tropical Construction and Development Corp.', 'vehicle_type' => ['Dump Truck', '10 Wheeler', 14, 14]],
            ['client' => 'Leighton Contractors (Asia)', 'quarry' => 'SOLID / J.C. Rodriguez Construction Corp.', 'vehicle_type' => ['Dump Truck', '10 Wheeler', 23, 27]],
            ['client' => 'Makati Development Corp. Ayala', 'quarry' => 'Romeo & Jayda Construction Supply Corp.', 'vehicle_type' => ['Articulated Dump Truck', '12 Wheeler', 31, 38]],
            ['client' => 'Maynilad Water Services, Inc.', 'quarry' => 'Majestic Builders Corp.', 'vehicle_type' => null],
            ['client' => 'San Miguel Corporation (SMC)', 'quarry' => 'Montalban Millex Aggregates Corp.', 'vehicle_type' => null],
            ['client' => 'Taisei Philippine Construction, Inc.', 'quarry' => 'BKL Construction Corporation', 'vehicle_type' => null],
        ];

        foreach ($mappings as $map) {
            $client = Client::query()->where('client_name', $map['client'])->first();
            $quarry = Quarry::query()->where('quarry_name', $map['quarry'])->first();
            if (! $client || ! $quarry) {
                continue;
            }

            $vehicleTypeId = null;
            if ($map['vehicle_type']) {
                [$name, $wheel, $min, $max] = $map['vehicle_type'];
                $vehicleTypeId = VehicleType::query()
                    ->where('name', $name)
                    ->where('wheel_type', $wheel)
                    ->where('min_cbm', $min)
                    ->where('max_cbm', $max)
                    ->value('id');
            }

            ClientQuarryVehiclePreference::updateOrCreate(
                [
                    'client_id' => $client->id,
                    'quarry_id' => $quarry->id,
                    'vehicle_type_id' => $vehicleTypeId,
                ],
                [
                    'is_default' => true,
                    'status' => 'active',
                ]
            );
        }
    }
}
