<?php

namespace Tests\Feature;

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
            'password' => 'password123',
            'phone' => '09171234567',
            'status' => 'active',
        ]);

        $response->assertCreated()
            ->assertJsonPath('role.name', 'driver')
            ->assertJsonPath('email', 'pedro.driver@example.com');

        $userId = $response->json('id');

        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'email' => 'pedro.driver@example.com',
            'phone' => '09171234567',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('drivers', [
            'user_id' => $userId,
            'full_name' => 'Pedro Driver',
        ]);
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

    public function test_customer_role_still_blocked_from_user_management(): void
    {
        $admin = $this->makeAdmin();
        $customerRole = Role::where('name', 'customer')->first();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'role_id' => $customerRole->id,
            'name' => 'Customer User',
            'email' => 'customer.blocked@example.com',
            'password' => 'password123',
            'status' => 'active',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['role_id']);
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
