<?php

namespace Tests\Feature;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\OcrResult;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Ocr\GoogleDocumentAiService;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class OcrConfidenceIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_google_ocr_persists_weighted_confidence_model_in_diagnostics(): void
    {
        Storage::fake('public');
        config(['ocr.provider' => 'document_ai', 'ocr.engine' => 'local']);

        $mock = Mockery::mock(GoogleDocumentAiService::class);
        $mock->shouldReceive('extractFromImage')
            ->once()
            ->andReturn([
                'text' => "DELIVERY RECEIPT\nDR No: DR-2936806\n730 230 215 36.09",
                'confidence' => 0.87,
                'engine' => 'google-document-ai',
                'command' => 'google.documentai.processDocument',
                'structured_hints' => [
                    'entities' => [],
                    'table_lines' => ['1 1 Crushed Aggregate 730 230 215 36.09'],
                    'neighbor_pairs' => [],
                    'entity_mentions' => [],
                ],
                'provider_signals' => [
                    'entity_confidence_avg' => 0.87,
                    'entities_count' => 2,
                    'tables_count' => 1,
                    'pages_count' => 1,
                ],
                'diagnostics' => [
                    'provider' => 'document_ai',
                    'entities_count' => 2,
                    'pages_count' => 1,
                ],
            ]);
        $this->app->instance(GoogleDocumentAiService::class, $mock);

        [$driverUser, $assignment] = $this->createDriverAssignment(DeliveryStatus::ARRIVED);

        $response = $this->actingAs($driverUser, 'sanctum')->postJson('/api/driver/documents', [
            'assignment_id' => $assignment->id,
            'type' => 'receipt',
            'file' => UploadedFile::fake()->image('receipt.png'),
        ]);

        $response->assertCreated();

        $documentId = (int) $response->json('document.id');
        $ocr = OcrResult::query()->where('document_id', $documentId)->first();
        $this->assertNotNull($ocr);
        $this->assertNotNull($ocr->confidence_score);
        $this->assertIsArray($ocr->ocr_diagnostics);
        $this->assertSame('weighted-v1', $ocr->ocr_diagnostics['confidence_model']['version'] ?? null);
        $this->assertArrayHasKey('signals', $ocr->ocr_diagnostics['confidence_model'] ?? []);
    }

    /**
     * @return array{0:User,1:DispatchAssignment}
     */
    private function createDriverAssignment(string $status): array
    {
        $driverRole = Role::create(['name' => 'driver']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);

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
            'license_no' => 'TEST-LIC-OCR',
            'availability' => 'busy',
            'status' => 'active',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'OCR-1234',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'status' => DeliveryStatus::toJobOrderStatus($status),
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => $status,
            'assigned_at' => now(),
        ]);

        return [$driverUser, $assignment];
    }
}
