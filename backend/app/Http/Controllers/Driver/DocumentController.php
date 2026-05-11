<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDeliveryDocumentOcr;
use App\Models\DeliveryDocument;
use App\Services\Ocr\OcrService;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function __construct(private OcrService $ocrService)
    {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'type' => 'nullable|in:pod,receipt,gate_pass,weighbridge,signed_doc,other',
            'notes' => 'nullable|string',
            'file' => 'required|file|mimes:jpg,jpeg,png,gif,webp,pdf',
        ]);

        $assignment = \App\Models\DispatchAssignment::findOrFail($data['assignment_id']);
        $driverId = $request->user()?->driver?->id;

        if ($assignment->driver_id !== $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $path = $request->file('file')->store('delivery_documents', 'public');

        $document = DeliveryDocument::create([
            'assignment_id' => $assignment->id,
            'file_path' => $path,
            'type' => $data['type'] ?? 'other',
            'uploaded_by' => $request->user()?->id,
            'notes' => $data['notes'] ?? null,
        ]);

        $ocrResult = $this->ocrService->createPending($document);

        ProcessDeliveryDocumentOcr::dispatchAfterResponse($document->id);

        return response()->json([
            'document' => $document,
            'ocr_result' => $ocrResult,
        ], 201);
    }
}
