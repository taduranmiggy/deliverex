<?php

namespace Tests\Unit;

use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryDocument;
use Carbon\Carbon;
use Tests\TestCase;

class DeliveryDocumentTimestampCastTest extends TestCase
{
    public function test_delivery_document_uploaded_event_at_uses_datetime_cast(): void
    {
        $doc = new DeliveryDocument([
            'created_at' => '2026-06-30 10:15:00',
        ]);

        $this->assertInstanceOf(Carbon::class, $doc->created_at);
        $this->assertIsString($doc->uploaded_event_at);
        $this->assertStringContainsString('2026-06-30', $doc->uploaded_event_at);
    }

    public function test_completion_proof_submitted_event_at_uses_datetime_cast(): void
    {
        $proof = new DeliveryCompletionProof([
            'created_at' => '2026-06-30 12:30:00',
        ]);

        $this->assertInstanceOf(Carbon::class, $proof->created_at);
        $this->assertIsString($proof->submitted_event_at);
        $this->assertStringContainsString('2026-06-30', $proof->submitted_event_at);
    }
}
