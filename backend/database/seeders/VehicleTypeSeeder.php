<?php

namespace Database\Seeders;

use App\Models\VehicleType;
use Illuminate\Database\Seeder;

class VehicleTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['name' => 'Mini Dump', 'wheel_type' => '6 Wheeler', 'min_cbm' => 2, 'max_cbm' => 4, 'description' => 'Client operational profile'],
            ['name' => 'Medium Dump', 'wheel_type' => '6 Wheeler', 'min_cbm' => 6, 'max_cbm' => 8, 'description' => 'Client operational profile'],
            ['name' => 'Trailer Dump', 'wheel_type' => '10 Wheeler', 'min_cbm' => 18, 'max_cbm' => 22, 'description' => 'Client operational profile'],
            ['name' => 'Dump Truck', 'wheel_type' => '10 Wheeler', 'min_cbm' => 14, 'max_cbm' => 14, 'description' => 'Single-capacity variant'],
            ['name' => 'Dump Truck', 'wheel_type' => '10 Wheeler', 'min_cbm' => 23, 'max_cbm' => 27, 'description' => 'High-capacity variant'],
            ['name' => 'Articulated Dump Truck', 'wheel_type' => '12 Wheeler', 'min_cbm' => 31, 'max_cbm' => 38, 'description' => 'Client operational profile'],
            ['name' => '10-Wheeler', 'wheel_type' => '10 Wheeler', 'min_cbm' => 13, 'max_cbm' => 15, 'description' => 'Measured from dimensions'],
            ['name' => 'ADT', 'wheel_type' => '12 Wheeler', 'min_cbm' => 33, 'max_cbm' => 39, 'description' => 'Measured from dimensions'],
        ];

        foreach ($types as $type) {
            VehicleType::updateOrCreate(
                [
                    'name' => $type['name'],
                    'wheel_type' => $type['wheel_type'],
                    'min_cbm' => $type['min_cbm'],
                    'max_cbm' => $type['max_cbm'],
                ],
                [
                    'description' => $type['description'],
                    'status' => 'active',
                ]
            );
        }
    }
}
