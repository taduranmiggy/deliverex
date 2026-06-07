<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDeliveryDocumentOcr;
use App\Models\DeliveryDocument;
use App\Models\DispatchAssignment;
use App\Services\Notifications\NotificationDispatcher;
use App\Services\Ocr\OcrService;
use App\Support\DriverAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\File;

class DocumentController extends Controller
{
    public function __construct(
        private OcrService $ocrService,
        private NotificationDispatcher $notificationDispatcher
    ) {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'type'          => 'nullable|in:pod,receipt,gate_pass,weighbridge,signed_doc,invoice,job_order,departure,other',
            'notes'         => 'nullable|string|max:2000',
            'file'          => [
                'required',
                File::types(['jpg', 'jpeg', 'png'])
                    ->max(10240),
            ],
        ], [
            'file.required' => 'Please select an image to upload.',
            'file.max'      => 'Image must be under 10 MB.',
            'file.mimes'    => 'Only JPG, JPEG, and PNG images are supported for OCR.',
        ]);

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $path = $request->file('file')->store('delivery_documents', 'public');

        if (! $path) {
            return response()->json(['message' => 'Failed to store uploaded file. Check storage permissions.'], 500);
        }

        $document = DeliveryDocument::create([
            'assignment_id' => $assignment->id,
            'file_path'     => $path,
            'type'          => $data['type'] ?? 'other',
            'uploaded_by'   => $request->user()?->id,
            'notes'         => $data['notes'] ?? null,
        ]);

        if (($data['type'] ?? 'other') === 'pod') {
            $assignment->update([
                'pod_verified_at' => now(),
                'pod_verified_by' => $request->user()?->id,
            ]);
        }

        // Departure photo is "Start Trip Verification" proof only — store it without
        // running the OCR pipeline so OCR review and reports remain unaffected.
        if (($data['type'] ?? 'other') === 'departure') {
            return response()->json([
                'document'     => $document,
                'ocr_result'   => null,
                'job_order_id' => $assignment->job_order_id,
            ], 201);
        }

        $this->ocrService->createPending($document);
        $ocrResult = $this->runOcrPipeline($document);

        $document->load('ocrResult');
        $this->notificationDispatcher->documentUploaded($document);

        return response()->json([
            'document'     => $document,
            'ocr_result'   => $ocrResult,
            'job_order_id' => $assignment->job_order_id,
        ], 201);
    }

    private function runOcrPipeline(DeliveryDocument $document): \App\Models\OcrResult
    {
        $syncMode = config('ocr.sync_mode', true);

        if ($syncMode) {
            try {
                return $this->ocrService->process($document->fresh());
            } catch (\Throwable $e) {
                Log::error('OCR sync process failed', [
                    'document_id' => $document->id,
                    'error'       => $e->getMessage(),
                ]);
                ProcessDeliveryDocumentOcr::dispatch($document->id);

                return $document->fresh()->ocrResult;
            }
        }

        ProcessDeliveryDocumentOcr::dispatch($document->id);

        return $document->fresh()->ocrResult;
    }
}
