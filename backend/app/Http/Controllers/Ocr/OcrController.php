<?php

namespace App\Http\Controllers\Ocr;

use App\Http\Controllers\Controller;
use App\Models\DeliveryDocument;
use App\Services\Ocr\OcrService;

class OcrController extends Controller
{
    public function __construct(private OcrService $ocrService)
    {
    }

    public function process(DeliveryDocument $document)
    {
        $ocrResult = $this->ocrService->process($document->fresh());

        return response()->json($ocrResult->load('document.assignment.jobOrder'));
    }
}
