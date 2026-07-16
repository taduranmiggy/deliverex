<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryDocument;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\OcrResult;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $dispatcher;

    private User $driverUser;

    private Driver $driver;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::create(['name' => 'admin']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $driverRole = Role::create(['name' => 'driver']);

        $this->admin = User::factory()->create([
            'role_id' => $adminRole->id,
            'email' => 'admin@audit.test',
            'password' => Hash::make('AuditPass1!'),
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        $this->dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email' => 'dispatcher@audit.test',
            'password' => Hash::make('AuditPass1!'),
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        $this->driverUser = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        $this->driver = Driver::create([
            'user_id' => $this->driverUser->id,
            'license_no' => 'AUDIT-LIC',
            'availability' => 'busy',
            'status' => 'active',
        ]);
    }

    public function test_scenario_a_admin_login_is_recorded(): void
    {
        $this->postJson('/api/auth/login', [
            'email' => 'admin@audit.test',
            'password' => 'AuditPass1!',
            'platform' => 'web',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->admin->id,
            'action' => 'auth.login_success',
            'role_name' => 'admin',
        ]);

        $log = AuditLog::query()->where('action', 'auth.login_success')->first();
        $this->assertNotNull($log->module);
        $this->assertSame('Auth', $log->module);
    }

    public function test_scenario_b_dispatcher_job_order_create_is_recorded(): void
    {
        $company = Company::create([
            'company_name' => 'Audit Test Co',
            'company_email' => 'company@audit.test',
            'status' => Company::STATUS_ACTIVE,
            'created_by' => $this->admin->id,
        ]);

        $response = $this->apiAs($this->dispatcher)->postJson('/api/dispatch/job-orders', [
            'company_id' => $company->id,
            'pickup_street' => 'Quarry Gate 1',
            'pickup_barangay' => 'Industrial Park',
            'pickup_city' => 'Quezon City',
            'pickup_province' => 'Metro Manila',
            'dropoff_street' => 'Construction Site Alpha',
            'dropoff_barangay' => 'San Antonio',
            'dropoff_city' => 'Pasig City',
            'dropoff_province' => 'Metro Manila',
            'load_volume_m3' => 12,
            'custom_material_type_name' => 'Gravel',
            'custom_specification_name' => '3/4 inch',
            'scheduled_start' => now()->addHour()->toIso8601String(),
            'scheduled_end' => now()->addHours(3)->toIso8601String(),
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->dispatcher->id,
            'action' => 'job_order.created',
            'role_name' => 'dispatcher',
        ]);
    }

    public function test_scenario_c_driver_delivery_completion_is_recorded(): void
    {
        $vehicle = Vehicle::create([
            'plate_no' => 'AUDIT-001',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'in_operation',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'status' => 'in_progress',
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => DeliveryStatus::ARRIVED_AT_DESTINATION,
            'assigned_at' => now(),
        ]);

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ])->assertStatus(422);

        Storage::fake('public');
        $this->apiAs($this->driverUser)->postJson('/api/driver/completion-proof', [
            'assignment_id' => $assignment->id,
            'proof_type' => DeliveryCompletionProof::TYPE_RECEIPT_PHOTO,
            'receiver_name' => 'Receiver',
            'file' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertCreated();

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->driverUser->id,
            'action' => 'delivery.status_changed',
            'subject_id' => $assignment->id,
        ]);

        $statusLog = AuditLog::query()
            ->where('action', 'delivery.status_changed')
            ->where('subject_id', $assignment->id)
            ->first();

        $this->assertNotNull($statusLog);
        $this->assertSame(DeliveryStatus::ARRIVED_AT_DESTINATION, $statusLog->changes['status']['old'] ?? null);
        $this->assertSame(DeliveryStatus::COMPLETED, $statusLog->changes['status']['new'] ?? null);
    }

    public function test_scenario_d_ocr_validation_approved_is_recorded(): void
    {
        $vehicle = Vehicle::create([
            'plate_no' => 'OCR-AUDIT',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'status' => 'completed',
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => 'completed',
            'assigned_at' => now(),
        ]);

        $document = DeliveryDocument::create([
            'assignment_id' => $assignment->id,
            'file_path' => 'ocr/audit-slip.jpg',
            'type' => 'receipt',
            'uploaded_by' => $this->driverUser->id,
        ]);

        $ocr = OcrResult::create([
            'document_id' => $document->id,
            'processing_status' => 'needs_review',
            'review_status' => 'pending_review',
            'extracted_text' => 'sample',
            'assignment_id' => $assignment->id,
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'confidence_score' => 0.8,
            'engine' => 'tesseract',
        ]);

        $this->apiAs($this->admin)->putJson("/api/ocr/{$ocr->id}/validate", [
            'action' => 'approve',
            'notes' => 'Looks good',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->admin->id,
            'action' => 'ocr.approve',
            'subject_id' => $ocr->id,
        ]);
    }

    public function test_scenario_e_password_reset_is_recorded(): void
    {
        $this->apiAs($this->admin)->postJson('/api/auth/change-password', [
            'current_password' => 'AuditPass1!',
            'password' => 'NewAuditPass1!',
            'password_confirmation' => 'NewAuditPass1!',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->admin->id,
            'action' => 'auth.password_changed',
        ]);
    }

    public function test_audit_logs_api_is_admin_only(): void
    {
        $this->apiAs($this->dispatcher)->getJson('/api/admin/audit-logs')->assertForbidden();
        $this->apiAs($this->admin)->getJson('/api/admin/audit-logs')->assertOk();
    }
}
