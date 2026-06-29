<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryDocument;
use App\Models\DeliveryStatusHistory;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CustomerPortalProofTest extends TestCase
{
    use RefreshDatabase;

    public function test_portal_orders_includes_receipt_photo_completion_proof_as_documents(): void
    {
        Storage::fake('public');

        $customerRole = Role::query()->create(['name' => 'customer']);
        $driverRole = Role::query()->create(['name' => 'driver']);
        $dispatcherRole = Role::query()->create(['name' => 'dispatcher']);

        $company = Company::query()->create([
            'company_name' => 'Acme Logistics',
            'company_email' => 'owner@acme.test',
            'status' => Company::STATUS_ACTIVE,
        ]);

        $customer = User::factory()->create([
            'role_id' => $customerRole->id,
            'email_verified_at' => now(),
        ]);

        CompanyUser::query()->create([
            'company_id' => $company->id,
            'user_id' => $customer->id,
            'role' => CompanyUser::ROLE_OWNER,
            'is_active' => true,
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
            'license_no' => 'TEST-LIC-POD',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'POD-1234',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'company_id' => $company->id,
            'status' => DeliveryStatus::toJobOrderStatus(DeliveryStatus::COMPLETED),
            'tracking_code' => 'FJVZJOLMLM',
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => DeliveryStatus::ARRIVED,
            'assigned_at' => now(),
        ]);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
            'notes' => 'Delivered',
            'created_at' => now(),
        ]);

        DeliveryStatusHistory::create([
            'job_order_id' => $jobOrder->id,
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
            'updated_by' => $dispatcher->id,
            'updated_at' => now(),
            'remarks' => 'Delivered',
            'created_at' => now(),
        ]);

        $proofResponse = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/completion-proof', [
            'assignment_id' => $assignment->id,
            'proof_type' => DeliveryCompletionProof::TYPE_RECEIPT_PHOTO,
            'receiver_name' => 'Juan Dela Cruz',
            'file' => UploadedFile::fake()->image('receipt.jpg'),
        ]);

        $proofResponse->assertCreated();

        $this->assertDatabaseHas('delivery_documents', [
            'assignment_id' => $assignment->id,
            'type' => 'receipt',
        ]);

        $response = $this->actingAs($customer, 'sanctum')->getJson('/api/customer/portal/orders');

        $response->assertOk()
            ->assertJsonPath('data.0.tracking_code', 'FJVZJOLMLM')
            ->assertJsonPath('data.0.status', DeliveryStatus::COMPLETED);

        $documents = $response->json('data.0.documents');
        $this->assertIsArray($documents);
        $this->assertNotEmpty($documents);
        $this->assertSame('Delivery Receipt Photo', $documents[0]['label']);
        $this->assertSame('receipt', $documents[0]['type']);
        $this->assertNotEmpty($documents[0]['url']);
        $this->assertArrayHasKey('ocr_ready', $documents[0]);
    }

    public function test_portal_orders_includes_standalone_pod_upload_not_in_completion_proof(): void
    {
        Storage::fake('public');

        $customerRole = Role::query()->create(['name' => 'customer']);
        $driverRole = Role::query()->create(['name' => 'driver']);
        $dispatcherRole = Role::query()->create(['name' => 'dispatcher']);

        $company = Company::query()->create([
            'company_name' => 'Beta Logistics',
            'company_email' => 'owner@beta.test',
            'status' => Company::STATUS_ACTIVE,
        ]);

        $customer = User::factory()->create([
            'role_id' => $customerRole->id,
            'email_verified_at' => now(),
        ]);

        CompanyUser::query()->create([
            'company_id' => $company->id,
            'user_id' => $customer->id,
            'role' => CompanyUser::ROLE_OWNER,
            'is_active' => true,
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
            'license_no' => 'TEST-LIC-POD2',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'POD-5678',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'company_id' => $company->id,
            'status' => DeliveryStatus::toJobOrderStatus(DeliveryStatus::COMPLETED),
            'tracking_code' => 'STANDALONEPOD',
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => DeliveryStatus::COMPLETED,
            'assigned_at' => now(),
        ]);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
            'notes' => 'Delivered',
            'created_at' => now(),
        ]);

        $path = UploadedFile::fake()->image('pod.jpg')->store('delivery_documents', 'public');

        DeliveryDocument::create([
            'assignment_id' => $assignment->id,
            'file_path' => $path,
            'type' => 'pod',
            'uploaded_by' => $driverUser->id,
        ]);

        $response = $this->actingAs($customer, 'sanctum')->getJson('/api/customer/portal/orders');

        $response->assertOk();

        $documents = collect($response->json('data.0.documents'));
        $this->assertTrue($documents->contains(fn ($doc) => $doc['type'] === 'pod' && $doc['label'] === 'Proof of Delivery'));
    }
}
