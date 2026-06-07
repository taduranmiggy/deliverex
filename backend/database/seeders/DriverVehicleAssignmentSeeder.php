<?php

namespace Database\Seeders;

use App\Models\Driver;
use App\Models\DriverVehicleAssignment;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

class DriverVehicleAssignmentSeeder extends Seeder
{
    public function run(): void
    {
        $driverNames = [
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
        ];

        $tenWheelerPlates = [
            'CBS 6496', 'CBS 4908', 'CCB 9083', 'CCI 3747', 'NES 3733', 'NIC 8346', 'CAH 1701', 'NGK 4977',
            'NIM 8467', 'CBS 7861', 'RCS 7808', 'NGL 8955', 'CBA 5090', 'NDO 3476', 'CCK 3641', 'NHF 5537',
            'NIG 8463', 'CCK 7361', 'CCO 3696', 'CCB 9027', 'NHF 5349', 'CBR 4958', 'CBA 3337', 'CCK 6106',
            'CCE 5173', 'CAM 3269', 'CAB 3356', 'CBN 1168', 'CBS 6331', 'NEU 3735',
        ];

        foreach ($driverNames as $index => $name) {
            $driver = Driver::query()->where('full_name', trim($name))->first();
            $vehicle = Vehicle::query()->where('plate_no', strtoupper(trim($tenWheelerPlates[$index] ?? '')))->first();
            if (! $driver || ! $vehicle) {
                continue;
            }

            DriverVehicleAssignment::updateOrCreate(
                [
                    'driver_id' => $driver->id,
                    'vehicle_id' => $vehicle->id,
                ],
                [
                    'is_primary' => true,
                    'status' => 'active',
                ]
            );
        }

        $validDriverIds = Driver::query()
            ->whereIn('full_name', array_map('trim', $driverNames))
            ->pluck('id')
            ->all();
        $validVehicleIds = Vehicle::query()
            ->whereIn('plate_no', array_map(fn (string $plate) => strtoupper(trim($plate)), $tenWheelerPlates))
            ->pluck('id')
            ->all();

        DriverVehicleAssignment::query()
            ->whereNotIn('driver_id', $validDriverIds)
            ->orWhereNotIn('vehicle_id', $validVehicleIds)
            ->delete();
    }
}
