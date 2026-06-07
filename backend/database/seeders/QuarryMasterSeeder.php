<?php

namespace Database\Seeders;

use App\Models\Quarry;
use Illuminate\Database\Seeder;

class QuarryMasterSeeder extends Seeder
{
    public function run(): void
    {
        $quarries = [
            'Dream Rock Resources Philippines, Inc.',
            'PL Mercado Builders',
            'Rodrock and Aggregates Corporation',
            'Tropical Construction and Development Corp.',
            'SOLID / J.C. Rodriguez Construction Corp.',
            'Romeo & Jayda Construction Supply Corp.',
            'Majestic Builders Corp.',
            'Montalban Millex Aggregates Corp.',
            'BKL Construction Corporation',
            'Conrock Development Corp.',
            'Monte Rock Corp.',
            'E.A. Cañaveral Construction',
        ];

        foreach ($quarries as $name) {
            Quarry::updateOrCreate(
                ['quarry_name' => trim($name)],
                ['status' => 'active']
            );
        }
    }
}
