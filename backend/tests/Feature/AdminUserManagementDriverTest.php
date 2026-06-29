<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Driver;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUserManagementDriverTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'dispatcher', 'manager', 'driver', 'customer'] as $name) {
            Role::firstOrCreate(['name' => $name]);
        }
    }

    public function test_admin_can_create_driver_user_via_user_management(): void
    {
        $admin = $this->makeAdmin();

        $driverRole = Role::where('name', 'driver')->first();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'role_id' => $driverRole->id,
            'name' => 'Pedro Driver',
            'email' => 'pedro.driver@example.com',
            'phone' => '09171234567',
        ]);

        $response->assertCreated()
            ->assertJsonPath('role.name', 'driver')
            ->assertJsonPath('email', 'pedro.driver@example.com');

        $userId = $response->json('id');

        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'email' => 'pedro.driver@example.com',
            'phone' => '09171234567',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('drivers', [
            'user_id' => $userId,
            'full_name' => 'Pedro Driver',
        ]);

        $this->assertNotNull(User::query()->find($userId)?->invited_at);
    }

    public function test_admin_can_update_driver_user_via_user_management(): void
    {
        $admin = $this->makeAdmin();
        $driverRole = Role::where('name', 'driver')->first();

        $user = User::factory()->create([
            'role_id' => $driverRole->id,
            'name' => 'Old Name',
            'email' => 'driver.update@example.com',
            'status' => 'active',
        ]);

        Driver::query()->create([
            'user_id' => $user->id,
            'full_name' => 'Old Name',
            'license_no' => 'LIC-001',
            'availability' => 'available',
            'status' => 'available',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/users/{$user->id}", [
            'name' => 'Updated Driver',
            'phone' => '09998887777',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Updated Driver')
            ->assertJsonPath('phone', '09998887777');

        $this->assertDatabaseHas('drivers', [
            'user_id' => $user->id,
            'full_name' => 'Updated Driver',
        ]);
    }

    public function test_admin_can_create_customer_user_with_new_company(): void
    {
        $admin = $this->makeAdmin();
        $customerRole = Role::where('name', 'customer')->first();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'role_id' => $customerRole->id,
            'name' => 'Customer User',
            'email' => 'customer.user@example.com',
            'phone' => '09171234567',
            'new_company' => [
                'company_name' => 'ABC Construction',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('role.name', 'customer')
            ->assertJsonPath('company_name', 'ABC Construction')
            ->assertJsonPath('status', 'pending');

        $companyId = $response->json('company_id');

        $this->assertDatabaseHas('companies', [
            'id' => $companyId,
            'company_name' => 'ABC Construction',
            'company_email' => 'customer.user@example.com',
            'contact_person' => 'Customer User',
            'contact_number' => '09171234567',
        ]);

        $this->assertDatabaseHas('company_users', [
            'user_id' => $response->json('id'),
            'company_id' => $companyId,
            'role' => CompanyUser::ROLE_OWNER,
        ]);
    }

    public function test_admin_can_resend_invite_for_pending_user(): void
    {
        $admin = $this->makeAdmin();
        $driverRole = Role::where('name', 'driver')->first();

        $user = User::factory()->create([
            'role_id' => $driverRole->id,
            'name' => 'Pending Driver',
            'email' => 'pending.driver@example.com',
            'status' => 'pending',
            'invited_at' => null,
            'invite_send_count' => 0,
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$user->id}/send-invite");

        $response->assertOk()
            ->assertJsonPath('message', 'Invitation email sent.')
            ->assertJsonPath('user.status', 'pending');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'status' => 'pending',
            'invite_send_count' => 1,
        ]);
    }

    private function makeAdmin(): User
    {
        $adminRole = Role::where('name', 'admin')->first();

        return User::factory()->create([
            'role_id' => $adminRole->id,
            'status' => 'active',
        ]);
    }
}
