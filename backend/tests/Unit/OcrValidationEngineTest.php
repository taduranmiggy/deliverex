<?php

namespace Tests\Unit;

use App\Models\DeliveryDocument;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\OcrResult;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Ocr\OcrValidationEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OcrValidationEngineTest extends TestCase
{
    use RefreshDatabase;

    public function test_flags_volume_mismatch_against_job_order(): void
    {
        $dispatcher = User::factory()->create();
        $job = JobOrder::factory()->create(['volume_m3' => 36.0, 'created_by' => $dispatcher->id]);
        $driver = Driver::create([
            'user_id' => User::factory()->create()->id,
            'license_no' => 'VAL-001',
            'availability' => 'available',
            'status' => 'active',
        ]);
        $vehicle = Vehicle::create([
            'plate_no' => 'ABC-1234',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);
        $assignment = DispatchAssignment::create([
            'job_order_id' => $job->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => 'assigned',
            'assigned_at' => now(),
        ]);
        $document = DeliveryDocument::create([
            'assignment_id' => $assignment->id,
            'file_path' => 'delivery_documents/test.jpg',
            'type' => 'receipt',
            'uploaded_by' => $dispatcher->id,
        ]);

        $result = OcrResult::create([
            'document_id' => $document->id,
            'processing_status' => 'processed',
            'review_status' => 'pending_review',
            'assignment_id' => $assignment->id,
            'job_order_id' => $job->id,
            'vehicle_plate_no' => 'ABC-1234',
            'driver_name' => 'Juan Dela Cruz',
        ]);

        $report = app(OcrValidationEngine::class)->validate($result, [
            'volume' => 10.0,
            'vehicle_plate' => 'ABC-1234',
            'driver_name' => 'Juan Dela Cruz',
            'delivery_receipt_number' => 'DR-12345',
            'length' => 730,
            'width' => 230,
            'height' => 215,
        ], $assignment);

        $this->assertSame('mismatch', $report['overall_status']);
        $this->assertContains('volume', $report['mismatches']);
        $this->assertSame('match', $report['fields']['vehicle_plate']['status']);
    }

    public function test_accepts_matching_volume_within_tolerance(): void
    {
        $result = new OcrResult([
            'processing_status' => 'processed',
            'review_status' => 'pending_review',
        ]);

        $assignment = new DispatchAssignment;
        $assignment->setRelation('jobOrder', new JobOrder(['volume_m3' => 36.09]));

        $report = app(OcrValidationEngine::class)->validate($result, [
            'volume' => 36.0,
            'length' => 730,
            'width' => 230,
            'height' => 215,
            'delivery_receipt_number' => 'DR-99999',
        ], $assignment);

        $this->assertContains($report['overall_status'], ['matched', 'partial']);
        $this->assertNotContains('volume', $report['mismatches']);
    }
}
