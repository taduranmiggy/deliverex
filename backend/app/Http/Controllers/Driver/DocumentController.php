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
            'type'          => 'nullable|in:pod,receipt,gate_pass,weighbridge,signed_doc,invoice,job_order,other',
            'notes'         => 'nullable|string',
            'file'          => 'required|file|mimes:jpg,jpeg,png|max:10240',
        ]);

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $path = $request->file('file')->store('delivery_documents', 'public');

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

        $this->ocrService->createPending($document);

        // Process immediately so OCR is ready without requiring a queue worker
        try {
            $ocrResult = $this->ocrService->process($document->fresh());
        } catch (\Throwable $e) {
            Log::error('OCR sync process failed', ['document_id' => $document->id, 'error' => $e->getMessage()]);
            // Queue as fallback if sync fails (timeout, etc.)
            ProcessDeliveryDocumentOcr::dispatch($document->id);
            $ocrResult = $document->fresh()->ocrResult;
        }

        $document->load('ocrResult');
        $this->notificationDispatcher->documentUploaded($document);

        return response()->json([
            'document'     => $document,
            'ocr_result'   => $ocrResult,
            'job_order_id' => $assignment->job_order_id,
        ], 201);
    }
}
