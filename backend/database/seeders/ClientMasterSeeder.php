<?php

namespace Database\Seeders;

use App\Models\Client;
use Illuminate\Database\Seeder;

class ClientMasterSeeder extends Seeder
{
    public function run(): void
    {
        $clients = [
            'Acciona Philippines Inc.',
            'China Road and Bridge Corp.',
            'DMCI Holdings, Inc.',
            'EEI Corporation',
            'Leighton Contractors (Asia)',
            'Makati Development Corp. Ayala',
            'Maynilad Water Services, Inc.',
            'San Miguel Corporation (SMC)',
            'Taisei Philippine Construction, Inc.',
        ];

        foreach ($clients as $name) {
            Client::updateOrCreate(
                ['client_name' => trim($name)],
                ['status' => 'active']
            );
        }
    }
}
