<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OcrResult;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;

class OcrReviewController extends Controller
{
    public function __construct(private NotificationDispatcher $notificationDispatcher)
    {
    }
    public function index(Request $request)
    {
        $query = OcrResult::with('document.completionProof', 'document.assignment.jobOrder', 'document.assignment.driver.user', 'document.assignment.vehicle')
            ->orderByDesc('created_at');
        $this->applyFilters($query, $request);

        $perPage = min(50, max(10, (int) $request->query('per_page', 20)));

        return response()->json(
            $query->paginate($perPage)->through(function (OcrResult $ocr) {
                $expectedVolume = (float) ($ocr->document?->assignment?->jobOrder?->load_volume_m3 ?? $ocr->document?->assignment?->jobOrder?->volume_m3 ?? 0);
                $actualVolume = (float) ($ocr->extracted_volume ?? 0);
                $volumeDelta = $expectedVolume > 0 ? abs($expectedVolume - $actualVolume) / $expectedVolume : null;
                $hasReceipt = ! empty($ocr->delivery_receipt_number);
                $hasDims = $ocr->extracted_length !== null && $ocr->extracted_width !== null && $ocr->extracted_height !== null;

                $matchStatus = 'partial_match';
                if ($hasReceipt && $hasDims && ($volumeDelta === null || $volumeDelta <= 0.1)) {
                    $matchStatus = 'matched';
                } elseif (! $hasReceipt && ! $hasDims) {
                    $matchStatus = 'mismatch';
                }

                $ocr->setAttribute('validation_result', [
                    'match_status' => $matchStatus,
                    'volume_delta_ratio' => $volumeDelta,
                    'expected_volume' => $expectedVolume > 0 ? $expectedVolume : null,
                    'actual_volume' => $ocr->extracted_volume,
                    'has_delivery_receipt_number' => $hasReceipt,
                    'has_dimensions' => $hasDims,
                ]);

                return $ocr;
            })
        );
    }

    public function export(Request $request)
    {
        $query = OcrResult::with('validator', 'document.assignment.jobOrder')
            ->orderByDesc('created_at');
        $this->applyFilters($query, $request);

        if (! $query->exists()) {
            return response()->json([
                'message' => 'No OCR records found for selected filters.',
            ], 422);
        }

        $fileName = 'OCR_Report_'.now()->format('Y_m_d').'.xlsx';
        $tmpPath = storage_path('app/tmp_'.$fileName);

        $writer = new Writer;
        $writer->openToFile($tmpPath);
        $writer->addRow(new Row([
            Cell::fromValue('Job Order ID'),
            Cell::fromValue('Delivery Receipt No'),
            Cell::fromValue('Length'),
            Cell::fromValue('Width'),
            Cell::fromValue('Height'),
            Cell::fromValue('Volume'),
            Cell::fromValue('Plate Number'),
            Cell::fromValue('Driver Name'),
            Cell::fromValue('Delivery Date'),
            Cell::fromValue('OCR Status'),
            Cell::fromValue('Review Status'),
            Cell::fromValue('Reviewed By'),
        ]));

        foreach ($query->cursor() as $ocr) {
            /** @var OcrResult $ocr */
            $writer->addRow(new Row([
                Cell::fromValue($ocr->job_order_id ? ('JO-'.$ocr->job_order_id) : '—'),
                Cell::fromValue($ocr->delivery_receipt_number ?: '—'),
                Cell::fromValue($ocr->extracted_length ?? '—'),
                Cell::fromValue($ocr->extracted_width ?? '—'),
                Cell::fromValue($ocr->extracted_height ?? '—'),
                Cell::fromValue($ocr->extracted_volume ?? '—'),
                Cell::fromValue($ocr->vehicle_plate_no ?: '—'),
                Cell::fromValue($ocr->driver_name ?: '—'),
                Cell::fromValue($ocr->delivery_date ? $ocr->delivery_date->toDateTimeString() : '—'),
                Cell::fromValue($ocr->processing_status ?: '—'),
                Cell::fromValue($ocr->review_status ?: '—'),
                Cell::fromValue($ocr->validator?->name ?: '—'),
            ]));
        }

        $writer->close();

        return response()->download($tmpPath, $fileName)->deleteFileAfterSend(true);
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
        $role = strtolower((string) $request->user()?->role?->name);
        if ($role !== 'admin') {
            return response()->json([
                'message' => 'Only Admin can validate or modify OCR review results.',
            ], 403);
        }

        $data = $request->validate([
            'action'           => 'required|in:approve,reject,flag',
            'corrected_text'   => 'nullable|string',
            'reject_reason'    => 'nullable|string|max:500',
            'notes'            => 'nullable|string|max:1000',
            'issue_type'       => 'nullable|in:missing_data,poor_image_quality,ocr_mismatch,wrong_upload,incomplete_document,other',
            'confidence_score' => 'nullable|numeric|min:0|max:1',
        ]);
        $issueType = ($data['issue_type'] ?? null) === 'ocr_mismatch'
            ? 'poor_image_quality'
            : ($data['issue_type'] ?? null);

        match ($data['action']) {
            'approve' => $ocrResult->forceFill([
                'processing_status' => 'validated',
                'review_status'     => 'verified',
                'is_validated'      => true,
                'validated_by'      => $request->user()?->id,
                'corrected_text'    => $data['corrected_text'] ?? $ocrResult->corrected_text,
                'confidence_score'  => $data['confidence_score'] ?? $ocrResult->confidence_score,
                'review_notes'      => $data['notes'] ?? null,
                'reviewed_at'       => now(),
                'error_message'     => null,
            ])->save(),
            'reject' => $ocrResult->forceFill([
                'processing_status' => 'failed',
                'review_status'     => 'rejected',
                'is_validated'      => false,
                'error_message'     => trim(implode(' · ', array_filter([
                    $issueType,
                    $data['reject_reason'] ?? 'Rejected by reviewer.',
                ]))),
                'review_notes'      => $data['notes'] ?? null,
                'reviewed_at'       => now(),
                'validated_by'      => $request->user()?->id,
            ])->save(),
            'flag' => $ocrResult->forceFill([
                'processing_status' => 'needs_review',
                'review_status'     => 'flagged',
                'is_validated'      => false,
                'error_message'     => trim(implode(' · ', array_filter([
                    $issueType,
                    $data['reject_reason'] ?? 'Flagged for further review.',
                ]))),
                'review_notes'      => $data['notes'] ?? null,
                'reviewed_at'       => now(),
                'validated_by'      => $request->user()?->id,
            ])->save(),
        };

        AuditLogger::record($request->user(), 'ocr.' . $data['action'], OcrResult::class, $ocrResult->id, [
            'document_id' => $ocrResult->document_id,
        ], $request);

        $this->notificationDispatcher->ocrValidated($ocrResult->fresh(), $data['action']);

        return response()->json($ocrResult->fresh()->load('document'));
    }

    private function applyFilters($query, Request $request): void
    {
        $filter = (string) $request->query('filter', 'all');
        $status = (string) $request->query('status', 'all');
        $jobOrderId = trim((string) $request->query('job_order_id', ''));
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        switch ($filter) {
            case 'waiting':
                $query->whereIn('processing_status', ['pending', 'processing', 'processed', 'completed'])
                    ->where('review_status', 'pending_review');
                break;
            case 'validated':
                $query->where('review_status', 'verified');
                break;
            case 'flagged':
                $query->whereIn('review_status', ['flagged', 'rejected']);
                break;
            default:
                break;
        }

        if ($status !== '' && $status !== 'all') {
            $query->where('review_status', $status);
        }

        if ($jobOrderId !== '') {
            $numeric = (int) preg_replace('/\D+/', '', $jobOrderId);
            if ($numeric > 0) {
                $query->where('job_order_id', $numeric);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($dateFrom) {
            $query->whereDate('delivery_date', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('delivery_date', '<=', $dateTo);
        }
    }
}
