<?php

namespace Database\Seeders;

use App\Models\Driver;
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
        }
    }
}
