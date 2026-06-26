<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

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
            $slug = Str::slug($name, '.');
            Company::updateOrCreate(
                ['company_name' => trim($name)],
                [
                    'company_email' => "{$slug}@demo.deliverex",
                    'status' => Company::STATUS_ACTIVE,
                ]
            );
        }
    }
}
