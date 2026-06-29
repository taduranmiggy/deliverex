<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\DeliveryDocument;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\OcrResult;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OcrFieldCorrectionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_partial_field_corrections_without_approving(): void
    {
        [$admin, $ocr] = $this->seedOcrPair('admin');

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/ocr/{$ocr->id}/corrections", [
            'fields' => [
                'length' => 735,
                'delivery_receipt_number' => 'DR-2936806',
            ],
            'reason' => 'Handwriting misread',
        ]);

        $response->assertOk()
            ->assertJsonPath('field_corrections.length.corrected', 735)
            ->assertJsonPath('field_corrections.length.original', 730)
            ->assertJsonPath('effective_values.length', 735);

        $ocr->refresh();
        $this->assertEqualsWithDelta(730, (float) $ocr->extracted_length, 0.001);
        $this->assertSame('needs_review', $ocr->processing_status);
        $this->assertFalse($ocr->is_validated);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'ocr.corrections.save',
            'subject_type' => OcrResult::class,
            'subject_id' => $ocr->id,
        ]);
    }

    public function test_manager_cannot_save_field_corrections(): void
    {
        [$admin, $ocr] = $this->seedOcrPair('admin');
        $managerRole = Role::create(['name' => 'manager']);
        $manager = User::factory()->create([
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($manager, 'sanctum')->putJson("/api/ocr/{$ocr->id}/corrections", [
            'fields' => ['length' => 735],
        ])->assertForbidden();
    }

    public function test_save_corrections_rejects_non_positive_dimensions(): void
    {
        [$admin, $ocr] = $this->seedOcrPair('admin');

        $this->actingAs($admin, 'sanctum')->putJson("/api/ocr/{$ocr->id}/corrections", [
            'fields' => ['length' => 0],
        ])->assertUnprocessable();

        $this->actingAs($admin, 'sanctum')->putJson("/api/ocr/{$ocr->id}/corrections", [
            'fields' => ['delivery_receipt_number' => ''],
        ])->assertUnprocessable();
    }

    public function test_approve_applies_effective_structured_values_and_preserves_audit(): void
    {
        [$admin, $ocr] = $this->seedOcrPair('admin');

        $this->actingAs($admin, 'sanctum')->putJson("/api/ocr/{$ocr->id}/corrections", [
            'fields' => ['length' => 735],
        ])->assertOk();

        $this->actingAs($admin, 'sanctum')->putJson("/api/ocr/{$ocr->id}/validate", [
            'action' => 'approve',
        ])->assertOk()
            ->assertJsonPath('is_validated', true)
            ->assertJsonPath('extracted_length', 735);

        $ocr->refresh();
        $this->assertEqualsWithDelta(735, (float) $ocr->extracted_length, 0.001);
        $this->assertEqualsWithDelta(730, (float) $ocr->field_corrections['length']['original'], 0.001);

        $this->assertTrue(
            AuditLog::query()->where('action', 'ocr.approve')->where('subject_id', $ocr->id)->exists()
        );
    }

    /**
     * @return array{0:User,1:OcrResult}
     */
    private function seedOcrPair(string $actorRole): array
    {
        $adminRole = Role::create(['name' => 'admin']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $driverRole = Role::create(['name' => 'driver']);

        $admin = User::factory()->create([
            'role_id' => $adminRole->id,
            'email_verified_at' => now(),
        ]);

        $dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email_verified_at' => now(),
        ]);

        $driverUser = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
        ]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'license_no' => 'LIC-OCR-EDIT',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'EDIT-001',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'status' => 'completed',
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => 'completed',
            'assigned_at' => now(),
        ]);

        $document = DeliveryDocument::create([
            'assignment_id' => $assignment->id,
            'file_path' => 'ocr/test-slip.jpg',
            'type' => 'receipt',
            'uploaded_by' => $driverUser->id,
        ]);

        $ocr = OcrResult::create([
            'document_id' => $document->id,
            'processing_status' => 'needs_review',
            'review_status' => 'pending_review',
            'extracted_text' => 'L=730 W=230 H=215 V=36.09 NO:2936806',
            'extracted_length' => 730,
            'extracted_width' => 230,
            'extracted_height' => 215,
            'extracted_volume' => 36.09,
            'delivery_receipt_number' => 'DR-2936806',
            'assignment_id' => $assignment->id,
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'confidence_score' => 0.56,
            'engine' => 'google-document-ai',
            'ocr_diagnostics' => [
                'review_suggestions' => [
                    'supplier' => [['value' => 'CRBC', 'confidence' => 0.7]],
                ],
            ],
        ]);

        return [$admin, $ocr];
    }
}
