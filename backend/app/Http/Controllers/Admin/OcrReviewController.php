<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OcrResult;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class OcrReviewController extends Controller
{
    public function __construct(private NotificationDispatcher $notificationDispatcher)
    {
    }
    public function index(Request $request)
    {
        $filter = $request->query('filter', 'all');

        $query = OcrResult::with('document', 'document.assignment.jobOrder')
            ->orderByDesc('created_at');

        switch ($filter) {
            case 'waiting':
                $query->whereIn('processing_status', ['pending', 'processing', 'processed', 'completed'])
                      ->where('is_validated', false);
                break;
            case 'flagged':
                $query->where('processing_status', 'needs_review');
                break;
            case 'validated':
                $query->where('is_validated', true)
                      ->where('processing_status', 'validated');
                break;
            default:
                break;
        }

        return response()->json($query->paginate(20));
    }

    /**
     * Approve, reject, or flag an OCR result.
     * Expected payload:
     *   action          : approve | reject | flag   (required)
     *   corrected_text  : string                    (optional)
     *   reject_reason   : string                    (optional, for reject/flag)
     */
    public function validateResult(Request $request, OcrResult $ocrResult)
    {
        $data = $request->validate([
            'action'           => 'required|in:approve,reject,flag',
            'corrected_text'   => 'nullable|string',
            'reject_reason'    => 'nullable|string|max:500',
            'confidence_score' => 'nullable|numeric|min:0|max:1',
        ]);

        match ($data['action']) {
            'approve' => $ocrResult->forceFill([
                'processing_status' => 'validated',
                'is_validated'      => true,
                'validated_by'      => $request->user()?->id,
                'corrected_text'    => $data['corrected_text'] ?? $ocrResult->corrected_text,
                'confidence_score'  => $data['confidence_score'] ?? $ocrResult->confidence_score,
                'error_message'     => null,
            ])->save(),
            'reject' => $ocrResult->forceFill([
                'processing_status' => 'failed',
                'is_validated'      => false,
                'error_message'     => $data['reject_reason'] ?? 'Rejected by reviewer.',
                'validated_by'      => $request->user()?->id,
            ])->save(),
            'flag' => $ocrResult->forceFill([
                'processing_status' => 'needs_review',
                'is_validated'      => false,
                'error_message'     => $data['reject_reason'] ?? 'Flagged for further review.',
                'validated_by'      => $request->user()?->id,
            ])->save(),
        };

        AuditLogger::record($request->user(), 'ocr.' . $data['action'], OcrResult::class, $ocrResult->id, [
            'document_id' => $ocrResult->document_id,
        ], $request);

        $this->notificationDispatcher->ocrValidated($ocrResult->fresh(), $data['action']);

        return response()->json($ocrResult->fresh()->load('document'));
    }
}
