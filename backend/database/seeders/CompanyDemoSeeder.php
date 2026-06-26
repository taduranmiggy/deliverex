<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\User;
use Illuminate\Database\Seeder;

class CompanyDemoSeeder extends Seeder
{
    public function run(): void
    {
        $customer = User::query()->where('email', 'customer@deliverex.com')->first();
        if (! $customer) {
            return;
        }

        $company = Company::query()->updateOrCreate(
            ['company_email' => 'customer@deliverex.com'],
            [
                'company_name' => 'Demo Customer Co.',
                'contact_person' => 'Demo Customer',
                'contact_number' => null,
                'address' => null,
                'status' => Company::STATUS_ACTIVE,
            ],
        );

        CompanyUser::query()->updateOrCreate(
            ['user_id' => $customer->id],
            [
                'company_id' => $company->id,
                'role' => CompanyUser::ROLE_OWNER,
                'is_active' => true,
                'force_password_change' => false,
            ],
        );
    }
}
