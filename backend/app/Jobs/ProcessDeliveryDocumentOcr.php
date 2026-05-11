<?php

namespace App\Jobs;

use App\Models\DeliveryDocument;
use App\Services\Ocr\OcrService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessDeliveryDocumentOcr implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 180;

    public function __construct(public int $documentId)
    {
    }

    public function handle(OcrService $ocrService): void
    {
        $document = DeliveryDocument::query()->find($this->documentId);
        if (! $document) {
            return;
        }

        $ocrService->process($document);
    }
}
