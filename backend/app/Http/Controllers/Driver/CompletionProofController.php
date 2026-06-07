<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDeliveryDocumentOcr;
use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryDocument;
use App\Models\DispatchAssignment;
use App\Services\Notifications\NotificationDispatcher;
use App\Services\Ocr\OcrService;
use App\Support\AuditLogger;
use App\Support\DriverAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;

class CompletionProofController extends Controller
{
    public function __construct(
        private OcrService $ocrService,
        private NotificationDispatcher $notificationDispatcher,
    ) {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'proof_type'    => ['required', Rule::in(array_keys(DeliveryCompletionProof::TYPES))],
            'document_type' => 'nullable|in:receipt,pod,signed_doc,invoice,job_order,other',
            'receiver_name' => 'nullable|string|max:120',
            'receiver_contact' => 'nullable|string|max:40',
            'delivery_notes'   => 'nullable|string|max:2000',
            'file' => [
                'required',
                File::types(['jpg', 'jpeg', 'png'])->max(10240),
            ],
            'signature' => [
                'nullable',
                File::types(['jpg', 'jpeg', 'png'])->max(5120),
            ],
        ], [
            'file.required' => 'Please upload delivery proof (receipt photo or document image).',
        ]);

        $assignment = DispatchAssignment::with('jobOrder')->findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($assignment->status !== 'arrived') {
            return response()->json([
                'message' => 'Completion proof can only be submitted when the delivery status is Arrived.',
            ], 422);
        }

        if (DeliveryCompletionProof::where('assignment_id', $assignment->id)->exists()) {
            return response()->json([
                'message' => 'Completion proof already submitted for this assignment.',
            ], 422);
        }

        $docType = $data['proof_type'] === DeliveryCompletionProof::TYPE_RECEIPT_PHOTO
            ? 'receipt'
            : ($data['document_type'] ?? 'receipt');

        $path = $request->file('file')->store('delivery_documents', 'public');
        if (! $path) {
            return response()->json(['message' => 'Failed to store uploaded file.'], 500);
        }

        $document = DeliveryDocument::create([
            'assignment_id' => $assignment->id,
            'file_path'     => $path,
            'type'          => $docType,
            'uploaded_by'   => $request->user()?->id,
            'notes'         => $data['delivery_notes'] ?? null,
        ]);

        $signaturePath = null;
        if ($request->hasFile('signature')) {
            $signaturePath = $request->file('signature')->store('delivery_signatures', 'public');
        }

        $ocrResult = null;
        if ($data['proof_type'] === DeliveryCompletionProof::TYPE_OCR_DOCUMENT) {
            $this->ocrService->createPending($document);
            $ocrResult = $this->runOcrPipeline($document);
            $document->load('ocrResult');
            $this->notificationDispatcher->documentUploaded($document);
        }

        $proof = DeliveryCompletionProof::create([
            'job_order_id'           => $assignment->job_order_id,
            'assignment_id'          => $assignment->id,
            'driver_id'              => $driver->id,
            'reported_by'            => $request->user()->id,
            'proof_type'             => $data['proof_type'],
            'delivery_document_id'   => $document->id,
            'receiver_name'          => $data['receiver_name'] ?? null,
            'receiver_contact'       => $data['receiver_contact'] ?? null,
            'receiver_signature_path'=> $signaturePath,
            'delivery_notes'         => $data['delivery_notes'] ?? null,
        ]);

        AuditLogger::record($request->user(), 'delivery.completion_proof', DeliveryCompletionProof::class, $proof->id, [
            'assignment_id' => $assignment->id,
            'proof_type'    => $data['proof_type'],
        ], $request);

        return response()->json([
            'message'    => 'Completion proof submitted successfully.',
            'proof'      => $proof->load('deliveryDocument.ocrResult'),
            'ocr_result' => $ocrResult,
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
