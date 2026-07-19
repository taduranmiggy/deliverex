<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\NotificationLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnterpriseAuditAndReportsTest extends TestCase
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
            'name' => 'Juan Dela Cruz',
            'role_id' => $adminRole->id,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);
        $this->manager = User::factory()->create([
            'name' => 'Maria Manager',
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);
    }

    public function test_central_middleware_records_uninstrumented_module_action(): void
    {
        $notification = NotificationLog::create([
            'user_id' => $this->admin->id,
            'title' => 'Dispatch assigned',
            'message' => 'A driver was assigned.',
            'is_read' => false,
        ]);

        $this->apiAs($this->admin)
            ->withHeader('User-Agent', 'EnterpriseAuditTest/1.0')
            ->putJson("/api/notifications/{$notification->id}/read")
            ->assertOk();

        $log = AuditLog::query()->where('action', 'notification.marked_read')->first();

        $this->assertNotNull($log);
        $this->assertSame('Juan Dela Cruz', $log->user_name);
        $this->assertSame('admin', $log->role_name);
        $this->assertSame('Notifications', $log->module);
        $this->assertSame('success', $log->status);
        $this->assertSame($notification->id, $log->subject_id);
        $this->assertStringContainsString('EnterpriseAuditTest/1.0', (string) $log->user_agent);
        $this->assertNotEmpty($log->description);
    }

    public function test_central_middleware_records_failed_action(): void
    {
        $notification = NotificationLog::create([
            'user_id' => $this->manager->id,
            'title' => 'Private',
            'message' => 'Manager only.',
            'is_read' => false,
        ]);

        $this->apiAs($this->admin)
            ->putJson("/api/notifications/{$notification->id}/read")
            ->assertForbidden();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->admin->id,
            'module' => 'Notifications',
            'status' => 'failed',
            'subject_id' => $notification->id,
        ]);
    }

    public function test_audit_filters_cover_module_user_role_action_date_and_keyword(): void
    {
        AuditLog::create([
            'user_id' => $this->admin->id,
            'user_name' => $this->admin->name,
            'role_name' => 'admin',
            'module' => 'Vehicle Management',
            'action' => 'vehicle.updated',
            'description' => 'Updated Vehicle NES-3733.',
            'status' => 'success',
            'subject_id' => 22,
        ]);
        AuditLog::create([
            'user_id' => $this->manager->id,
            'user_name' => $this->manager->name,
            'role_name' => 'manager',
            'module' => 'Analytics',
            'action' => 'analytics.viewed',
            'description' => 'Viewed analytics dashboard.',
            'status' => 'success',
        ]);

        $this->apiAs($this->admin)->getJson('/api/admin/audit-logs?module=all&per_page=20')
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonStructure(['filter_options' => ['modules', 'users', 'roles', 'actions']]);

        $from = now()->subDay()->toDateString();
        $to = now()->addDay()->toDateString();
        $url = '/api/admin/audit-logs?module=Vehicle%20Management'
            .'&user='.$this->admin->id
            .'&role=admin&action=vehicle.updated'
            .'&from='.$from.'&to='.$to.'&search=NES-3733';

        $this->apiAs($this->admin)->getJson($url)
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.description', 'Updated Vehicle NES-3733.')
            ->assertJsonPath('data.0.status', 'success');
    }

    public function test_pdf_is_default_for_audit_and_enterprise_exports(): void
    {
        AuditLog::create([
            'user_id' => $this->admin->id,
            'user_name' => $this->admin->name,
            'role_name' => 'admin',
            'module' => 'Auth',
            'action' => 'auth.login_success',
            'description' => 'Logged In.',
            'status' => 'success',
        ]);

        $audit = $this->apiAs($this->admin)->get('/api/admin/audit-logs/export?all_records=1');
        $audit->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $audit->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $audit->getContent());

        $drivers = $this->apiAs($this->manager)->get('/api/reports/export?type=drivers&all_records=1');
        $drivers->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $drivers->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $drivers->getContent());
    }

    public function test_manager_cannot_export_admin_only_system_logs(): void
    {
        $this->apiAs($this->manager)
            ->get('/api/reports/export?type=system_logs')
            ->assertForbidden();
    }
}
