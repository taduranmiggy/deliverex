<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Http\Requests\Driver\StoreDeliveryDocumentRequest;
use App\Jobs\ProcessDeliveryDocumentOcr;
use App\Models\DeliveryDocument;
use App\Models\DispatchAssignment;
use App\Services\Notifications\NotificationDispatcher;
use App\Services\Ocr\OcrService;
use App\Support\ActionTimestamp;
use App\Support\AuditLogger;
use App\Support\DeliveryStatus;
use App\Support\DriverAccount;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

class DocumentController extends Controller
{
    /** Document types that skip OCR and are stored on the assignment only. */
    private const STORE_ONLY_TYPES = [
        'departure',
    ];

    /** OCR document types that require Arrived or Completed before upload. */
    private const STATUS_GATED_OCR_TYPES = [
        'pod',
        'receipt',
        'gate_pass',
        'weighbridge',
        'signed_doc',
        'invoice',
        'job_order',
    ];

    public function __construct(
        private OcrService $ocrService,
        private NotificationDispatcher $notificationDispatcher
    ) {
    }

    public function store(StoreDeliveryDocumentRequest $request)
    {
        $data = $request->validated();

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $type = $data['type'] ?? 'other';
        $storeOnly = in_array($type, self::STORE_ONLY_TYPES, true);
        $requiresArrivalGate = in_array($type, self::STATUS_GATED_OCR_TYPES, true);
        $status = DeliveryStatus::canonicalize($assignment->status) ?? $assignment->status;
        if ($requiresArrivalGate && ! in_array($status, [DeliveryStatus::ARRIVED, DeliveryStatus::COMPLETED], true)) {
            return response()->json([
                'message' => 'OCR uploads are only allowed when delivery status is Arrived or Completed.',
            ], 422);
        }

        $uploadedFile = $request->file('file');

        // Inspect the upload BEFORE it is moved off the temp path. This adds
        // defensive logging only — the bytes handed to OCR are never altered.
        $uploadMeta = $this->inspectUpload($uploadedFile);

        $path = $uploadedFile->store('delivery_documents', 'public');

        if (! $path) {
            return response()->json(['message' => 'Failed to store uploaded file. Check storage permissions.'], 500);
        }

        $actionAt = ActionTimestamp::resolveFromRequest($request);

        $document = new DeliveryDocument([
            'assignment_id' => $assignment->id,
            'file_path'     => $path,
            'type'          => $type,
            'uploaded_by'   => $request->user()?->id,
            'notes'         => $data['notes'] ?? null,
        ]);
        $document->created_at = $actionAt;
        $document->updated_at = $actionAt;
        $document->save();

        $this->recordUploadAudit($request, $document, $assignment, $uploadMeta);

        if ($type === 'pod') {
            $assignment->update([
                'pod_verified_at' => $actionAt,
                'pod_verified_by' => $request->user()?->id,
            ]);
        }

        // Store-only types (e.g. departure) skip the OCR pipeline.
        if ($storeOnly) {
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

    /**
     * Inspect the uploaded file for content/extension mismatches.
     *
     * Read-only: it never modifies the file (no metadata stripping/re-encoding),
     * so OCR receives the exact original bytes. EXIF stripping is intentionally
     * skipped here because re-encoding could drop orientation data and degrade
     * OCR accuracy — the safer alternative is to log + audit instead.
     */
    private function inspectUpload(?UploadedFile $file): array
    {
        if (! $file) {
            return ['suspicious' => false];
        }

        $aliases = ['jpg' => 'jpeg', 'jpeg' => 'jpeg', 'png' => 'png'];

        $clientExt   = strtolower((string) $file->getClientOriginalExtension());
        $detectedExt = strtolower((string) $file->guessExtension());
        $clientMime  = (string) $file->getClientMimeType();

        $normClient   = $aliases[$clientExt] ?? $clientExt;
        $normDetected = $aliases[$detectedExt] ?? $detectedExt;

        // Suspicious = the real (sniffed) content type disagrees with the
        // declared extension, e.g. a script renamed to .jpg.
        $suspicious = $detectedExt !== '' && $normClient !== '' && $normClient !== $normDetected;

        return [
            'original_name'      => $file->getClientOriginalName(),
            'client_extension'   => $clientExt,
            'detected_extension' => $detectedExt,
            'client_mime'        => $clientMime,
            'size_bytes'         => $file->getSize(),
            'suspicious'         => $suspicious,
        ];
    }

    private function recordUploadAudit(Request $request, DeliveryDocument $document, DispatchAssignment $assignment, array $uploadMeta): void
    {
        $meta = array_merge([
            'document_id'   => $document->id,
            'assignment_id' => $assignment->id,
            'job_order_id'  => $assignment->job_order_id,
            'type'          => $document->type,
        ], $uploadMeta);

        try {
            if (! empty($uploadMeta['suspicious'])) {
                Log::warning('Suspicious delivery document upload (content/extension mismatch)', $meta);
                AuditLogger::record($request->user(), 'document.upload_suspicious', DeliveryDocument::class, $document->id, $meta, $request);
            }

            AuditLogger::record($request->user(), 'document.uploaded', DeliveryDocument::class, $document->id, $meta, $request);
        } catch (\Throwable $e) {
            // Audit logging must never block a real upload/OCR run.
            Log::warning('Failed to record document upload audit', [
                'document_id' => $document->id,
                'error'       => $e->getMessage(),
            ]);
        }
    }
}
