<?php

namespace App\Http\Controllers\Ocr;

use App\Http\Controllers\Controller;
use App\Models\DeliveryDocument;
use App\Models\OcrResult;
use App\Services\Ocr\OcrService;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class OcrController extends Controller
{
    public function __construct(private OcrService $ocrService)
    {
    }

    public function process(Request $request, DeliveryDocument $document)
    {
        $document->loadMissing('assignment.jobOrder');
        $assignmentId = $document->assignment_id;
        $jobOrderId = $document->assignment?->job_order_id;

        AuditLogger::record($request->user(), 'ocr.processing_started', DeliveryDocument::class, $document->id, [
            'assignment_id' => $assignmentId,
            'job_order_id' => $jobOrderId,
        ], $request);

        try {
            $ocrResult = $this->ocrService->process($document->fresh());
        } catch (\Throwable $e) {
            AuditLogger::record($request->user(), 'ocr.processing_failed', DeliveryDocument::class, $document->id, [
                'assignment_id' => $assignmentId,
                'job_order_id' => $jobOrderId,
                'error' => $e->getMessage(),
            ], $request);

            throw $e;
        }

        $action = $ocrResult->processing_status === OcrService::STATUS_FAILED
            ? 'ocr.processing_failed'
            : 'ocr.processing_completed';

        AuditLogger::record($request->user(), $action, OcrResult::class, $ocrResult->id, [
            'assignment_id' => $assignmentId,
            'job_order_id' => $jobOrderId,
            'processing_status' => $ocrResult->processing_status,
            'confidence_score' => $ocrResult->confidence_score,
        ], $request);

        return response()->json($ocrResult->load('document.assignment.jobOrder'));
    }
}
