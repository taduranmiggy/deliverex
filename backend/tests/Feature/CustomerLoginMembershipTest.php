<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerLoginMembershipTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_login_repairs_missing_owner_membership_for_active_company(): void
    {
        $customerRole = Role::query()->create(['name' => 'customer']);

        $company = Company::query()->create([
            'company_name' => 'Acme Logistics',
            'company_email' => 'owner@acme.test',
            'status' => Company::STATUS_ACTIVE,
        ]);

        $user = User::query()->create([
            'role_id' => $customerRole->id,
            'name' => 'Acme Owner',
            'email' => 'owner@acme.test',
            'password' => Hash::make('Password1!'),
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->assertDatabaseMissing('company_users', ['user_id' => $user->id]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'owner@acme.test',
            'password' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'owner@acme.test');

        $this->assertDatabaseHas('company_users', [
            'user_id' => $user->id,
            'company_id' => $company->id,
            'role' => CompanyUser::ROLE_OWNER,
            'is_active' => true,
        ]);
    }

    public function test_customer_login_still_blocked_when_membership_is_deactivated(): void
    {
        $customerRole = Role::query()->create(['name' => 'customer']);

        $company = Company::query()->create([
            'company_name' => 'Acme Logistics',
            'company_email' => 'staff@acme.test',
            'status' => Company::STATUS_ACTIVE,
        ]);

        $user = User::query()->create([
            'role_id' => $customerRole->id,
            'name' => 'Acme Staff',
            'email' => 'staff@acme.test',
            'password' => Hash::make('Password1!'),
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        CompanyUser::query()->create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'role' => CompanyUser::ROLE_STAFF,
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'staff@acme.test',
            'password' => 'Password1!',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Company account is not active. Contact your administrator.');
    }

    public function test_customer_login_blocked_when_company_is_not_active(): void
    {
        $customerRole = Role::query()->create(['name' => 'customer']);

        $company = Company::query()->create([
            'company_name' => 'Pending Co',
            'company_email' => 'owner@pending.test',
            'status' => Company::STATUS_PENDING,
        ]);

        $user = User::query()->create([
            'role_id' => $customerRole->id,
            'name' => 'Pending Owner',
            'email' => 'owner@pending.test',
            'password' => Hash::make('Password1!'),
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        CompanyUser::query()->create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'role' => CompanyUser::ROLE_OWNER,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'owner@pending.test',
            'password' => 'Password1!',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Company is not active.');
    }
}
