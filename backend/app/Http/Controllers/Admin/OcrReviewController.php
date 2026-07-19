<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OcrResult;
use App\Services\Notifications\NotificationDispatcher;
use App\Services\Reports\ExportDateRange;
use App\Services\Reports\OcrReportQuery;
use App\Services\Reports\PdfReportRenderer;
use App\Services\Reports\ReportMetadata;
use App\Services\Reports\ReportSpreadsheetExporter;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class OcrReviewController extends Controller
{
    public function __construct(
        private NotificationDispatcher $notificationDispatcher,
        private OcrReportQuery $ocrReportQuery,
        private PdfReportRenderer $pdf,
        private ReportSpreadsheetExporter $spreadsheet,
    ) {
    }
    public function index(Request $request)
    {
        $query = OcrResult::with(
            'document.completionProof',
            'document.assignment.jobOrder.company',
            'document.assignment.jobOrder.quarry',
            'document.assignment.driver.user',
            'document.assignment.vehicle'
        )
            ->orderByDesc('created_at');
        $this->ocrReportQuery->applyFilters($query, $request);

        $perPage = min(50, max(1, (int) $request->query('per_page', 6)));

        return response()->json(
            $query->paginate($perPage)->through(function (OcrResult $ocr) {
                $expectedVolume = (float) ($ocr->document?->assignment?->jobOrder?->load_volume_m3 ?? $ocr->document?->assignment?->jobOrder?->volume_m3 ?? 0);
                $actualVolume = (float) ($ocr->getEffectiveValue('volume') ?? $ocr->extracted_volume ?? 0);
                $volumeDelta = $expectedVolume > 0 ? abs($expectedVolume - $actualVolume) / $expectedVolume : null;
                $hasReceipt = ! empty($ocr->getEffectiveValue('delivery_receipt_number') ?? $ocr->delivery_receipt_number);
                $hasDims = $ocr->getEffectiveValue('length') !== null
                    && $ocr->getEffectiveValue('width') !== null
                    && $ocr->getEffectiveValue('height') !== null;

                $matchStatus = 'partial_match';
                if ($hasReceipt && $hasDims && ($volumeDelta === null || $volumeDelta <= 0.1)) {
                    $matchStatus = 'matched';
                } elseif (! $hasReceipt && ! $hasDims) {
                    $matchStatus = 'mismatch';
                }

                $validationFromDiagnostics = is_array($ocr->ocr_diagnostics['validation'] ?? null)
                    ? $ocr->ocr_diagnostics['validation']
                    : null;

                $ocr->setAttribute('validation_result', $validationFromDiagnostics ? array_merge([
                    'match_status' => $validationFromDiagnostics['overall_status'] === 'matched'
                        ? 'matched'
                        : ($validationFromDiagnostics['overall_status'] === 'mismatch' ? 'mismatch' : 'partial_match'),
                    'mismatches' => $validationFromDiagnostics['mismatches'] ?? [],
                    'field_checks' => $validationFromDiagnostics['fields'] ?? [],
                ], $validationFromDiagnostics) : [
                    'match_status' => $matchStatus,
                    'volume_delta_ratio' => $volumeDelta,
                    'expected_volume' => $expectedVolume > 0 ? $expectedVolume : null,
                    'actual_volume' => $ocr->getEffectiveValue('volume') ?? $ocr->extracted_volume,
                    'has_delivery_receipt_number' => $hasReceipt,
                    'has_dimensions' => $hasDims,
                ]);
                $ocr->setAttribute('field_confidence', $ocr->ocr_diagnostics['field_confidence'] ?? []);
                $ocr->setAttribute('parser_status', $ocr->ocr_diagnostics['parser_status'] ?? null);
                $ocr->setAttribute('auxiliary_fields', $ocr->ocr_diagnostics['auxiliary_fields'] ?? []);
                $ocr->setAttribute('effective_values', $ocr->buildEffectiveValues());

                return $ocr;
            })
        );
    }

    public function export(Request $request)
    {
        $format = strtolower((string) $request->query('format', config('reports.default_format', 'pdf')));
        if (! in_array($format, ['pdf', 'xlsx', 'csv'], true)) {
            abort(422, 'Invalid export format. Use pdf, xlsx, or csv.');
        }

        $range = ExportDateRange::resolve($request, defaultDays: 30);
        $request = ExportDateRange::mergeIntoRequest($request, $range);

        ['query' => $query, 'filters' => $filters] = $this->ocrReportQuery->build($request);
        $query->with('validator', 'document.assignment.jobOrder')->orderByDesc('created_at');

        if (! $query->exists()) {
            return response()->json([
                'message' => 'No OCR records found for selected filters.',
            ], 422);
        }

        $headers = [
            'Job Order', 'Receipt No.', 'Length', 'Width', 'Height', 'Volume',
            'Plate No.', 'Driver', 'Delivery Date', 'OCR Status', 'Review Status', 'Reviewed By',
        ];
        $maxRows = (int) config('reports.export_max_rows', 10000);
        $rows = $query->limit($maxRows)->get()->map(fn (OcrResult $ocr) => [
            $ocr->job_order_id ? ('JO-'.$ocr->job_order_id) : '-',
            $ocr->getEffectiveValue('delivery_receipt_number') ?: '-',
            $ocr->getEffectiveValue('length') ?? '-',
            $ocr->getEffectiveValue('width') ?? '-',
            $ocr->getEffectiveValue('height') ?? '-',
            $ocr->getEffectiveValue('volume') ?? '-',
            $ocr->vehicle_plate_no ?: '-',
            $ocr->driver_name ?: '-',
            $ocr->delivery_date?->timezone(config('reports.default_timezone'))->format('Y-m-d H:i') ?? '-',
            $ocr->processing_status ?: '-',
            $ocr->review_status ?: '-',
            $ocr->validator?->name ?: '-',
        ])->all();

        $meta = ReportMetadata::fromRequest(
            $request,
            'ocr_reviews',
            'OCR Review Report',
            $filters,
            ['total_records' => count($rows)],
        );
        $fileName = $meta->fileSlug().'.'.$format;

        AuditLogger::record($request->user(), 'reports.export_'.$format, OcrResult::class, null, [
            'report_type' => 'ocr_reviews',
            'format' => $format,
            'file_name' => $fileName,
            'filters' => $filters,
        ], $request);

        return match ($format) {
            'pdf' => $this->pdf->render($meta, $headers, $rows, $fileName),
            'xlsx' => $this->spreadsheet->toXlsx($meta, $headers, $rows, $fileName),
            default => $this->spreadsheet->toCsv($meta, $headers, $rows, $fileName),
        };
    }

    /**
     * Save admin field corrections without approving (admin only).
     *
     * Expected payload:
     *   fields     : { length?: number, width?: number, ... }  (partial)
     *   issue_type : string (required)
     *   reason     : string (required, max 500)
     */
    public function saveCorrections(Request $request, OcrResult $ocrResult)
    {
        if (! $this->isAdmin($request)) {
            return response()->json([
                'message' => 'Only Admin can edit OCR review fields.',
            ], 403);
        }

        if ($ocrResult->is_validated) {
            return response()->json([
                'message' => 'Validated OCR records cannot be edited.',
            ], 422);
        }

        $data = $request->validate([
            'fields' => 'required|array',
            'fields.length' => 'nullable|numeric|gt:0',
            'fields.width' => 'nullable|numeric|gt:0',
            'fields.height' => 'nullable|numeric|gt:0',
            'fields.volume' => 'nullable|numeric|gt:0',
            'fields.delivery_receipt_number' => 'nullable|string|min:1|max:120',
            'issue_type' => 'required|in:ocr_misread,wrong_unit,missing_value,incorrect_format,low_ocr_accuracy,supplier_layout_difference,other',
            'reason' => 'required|string|min:1|max:500',
        ]);

        $incoming = array_intersect_key(
            $data['fields'],
            array_flip(OcrResult::CORRECTABLE_FIELDS)
        );

        if ($incoming === []) {
            return response()->json([
                'message' => 'No valid fields were provided.',
            ], 422);
        }

        $corrections = $ocrResult->correctionsMap();
        $userId = $request->user()?->id;
        $reason = trim($data['reason']);
        $issueType = $data['issue_type'];
        $auditChanges = [];

        foreach ($incoming as $field => $value) {
            $normalized = $this->normalizeIncomingFieldValue($field, $value);
            $original = $ocrResult->getOriginalValue($field);

            if ($this->valuesEquivalent($field, $original, $normalized)) {
                if (isset($corrections[$field])) {
                    unset($corrections[$field]);
                }
                continue;
            }

            $correctedAt = now()->toIso8601String();

            $corrections[$field] = [
                'original' => $original,
                'corrected' => $normalized,
                'corrected_by' => $userId,
                'corrected_at' => $correctedAt,
                'issue_type' => $issueType,
                'reason' => $reason,
            ];

            $auditChanges[] = [
                'field' => $field,
                'original' => $original,
                'corrected' => $normalized,
                'issue_type' => $issueType,
                'reason' => $reason,
                'corrected_by' => $userId,
                'corrected_at' => $correctedAt,
            ];
        }

        $ocrResult->forceFill([
            'field_corrections' => $corrections === [] ? null : $corrections,
        ])->save();

        if ($auditChanges !== []) {
            AuditLogger::record($request->user(), 'ocr.corrections.save', OcrResult::class, $ocrResult->id, [
                'document_id' => $ocrResult->document_id,
                'ocr_record_id' => $ocrResult->id,
                'issue_type' => $issueType,
                'reason' => $reason,
                'changes' => $auditChanges,
            ], $request);
        }

        $fresh = $ocrResult->fresh()->load('document');
        $fresh->setAttribute('effective_values', $fresh->buildEffectiveValues());

        return response()->json($fresh);
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
        if (! $this->isAdmin($request)) {
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
            'approve' => tap($ocrResult, function (OcrResult $ocr) use ($data, $request): void {
                $ocr->applyEffectiveStructuredFieldsToRecord();
                $ocr->forceFill([
                    'processing_status' => 'validated',
                    'review_status'     => 'verified',
                    'is_validated'      => true,
                    'validated_by'      => $request->user()?->id,
                    'corrected_text'    => $data['corrected_text'] ?? $ocr->corrected_text,
                    'confidence_score'  => $data['confidence_score'] ?? $ocr->confidence_score,
                    'review_notes'      => $data['notes'] ?? null,
                    'reviewed_at'       => now(),
                    'error_message'     => null,
                ])->save();
            }),
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
            'field_corrections' => $ocrResult->field_corrections,
            'effective_values' => $ocrResult->buildEffectiveValues(),
        ], $request);

        $this->notificationDispatcher->ocrValidated($ocrResult->fresh(), $data['action']);

        $response = $ocrResult->fresh()->load('document');
        $response->setAttribute('effective_values', $response->buildEffectiveValues());

        return response()->json($response);
    }

    private function isAdmin(Request $request): bool
    {
        return strtolower((string) $request->user()?->role?->name) === 'admin';
    }

    private function normalizeIncomingFieldValue(string $field, mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (in_array($field, ['length', 'width', 'height', 'volume'], true)) {
            return is_numeric($value) ? (float) $value : null;
        }

        return trim((string) $value);
    }

    private function valuesEquivalent(string $field, mixed $original, mixed $corrected): bool
    {
        if ($original === null && $corrected === null) {
            return true;
        }

        if (in_array($field, ['length', 'width', 'height', 'volume'], true)) {
            if (! is_numeric($original) || ! is_numeric($corrected)) {
                return (string) $original === (string) $corrected;
            }

            return abs((float) $original - (float) $corrected) < 0.0001;
        }

        return (string) $original === (string) $corrected;
    }
}
