<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportExportPreviewTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create(['name' => 'admin']);
        $managerRole = Role::create(['name' => 'manager']);

        $this->admin = User::factory()->create([
            'role_id' => $adminRole->id,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        $this->manager = User::factory()->create([
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);
    }

    public function test_audit_log_preview_defaults_to_last_30_days(): void
    {
        AuditLog::create([
            'user_id' => $this->admin->id,
            'role_name' => 'admin',
            'action' => 'auth.login',
            'module' => 'auth',
        ])->forceFill(['created_at' => now()->subDays(5)])->save();

        AuditLog::create([
            'user_id' => $this->admin->id,
            'role_name' => 'admin',
            'action' => 'auth.login',
            'module' => 'auth',
        ])->forceFill(['created_at' => now()->subDays(60)])->save();

        $this->apiAs($this->admin)->getJson('/api/exports/preview?report=audit_logs')
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('can_export', true);
    }

    public function test_audit_log_preview_all_records(): void
    {
        $log = AuditLog::create([
            'user_id' => $this->admin->id,
            'role_name' => 'admin',
            'action' => 'auth.login',
            'module' => 'auth',
        ]);
        $log->forceFill(['created_at' => now()->subDays(60)])->save();

        $this->apiAs($this->admin)->getJson('/api/exports/preview?report=audit_logs&all_records=1')
            ->assertOk()
            ->assertJsonPath('count', 1);
    }

    public function test_manager_can_preview_deliveries(): void
    {
        $this->apiAs($this->manager)->getJson('/api/exports/preview?report=deliveries')
            ->assertOk()
            ->assertJsonStructure(['count', 'export_count', 'can_export', 'date_range']);
    }

    public function test_admin_cannot_preview_manager_report(): void
    {
        $this->apiAs($this->admin)->getJson('/api/exports/preview?report=deliveries')
            ->assertForbidden();
    }

    public function test_driver_cannot_preview_exports(): void
    {
        $driverRole = Role::create(['name' => 'driver']);
        $driver = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
        ]);

        $this->apiAs($driver)->getJson('/api/exports/preview?report=audit_logs')
            ->assertForbidden();
    }
}
