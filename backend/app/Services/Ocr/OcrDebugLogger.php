<?php

namespace App\Services\Ocr;

use Illuminate\Support\Facades\Log;

/**
 * Writes structured OCR pipeline debug reports to storage/logs/ocr-debug.log.
 */
class OcrDebugLogger
{
    public function log(array $report): void
    {
        if (! config('ocr.debug_mode', true)) {
            return;
        }

        $lines = [
            '====================',
            'OCR DEBUG REPORT',
            '====================',
            'timestamp: '.($report['timestamp'] ?? now()->toDateTimeString()),
            'document_id: '.($report['document_id'] ?? 'unknown'),
            'ocr_result_id: '.($report['ocr_result_id'] ?? 'unknown'),
            '',
            '--- UPLOAD ---',
            'filename: '.($report['filename'] ?? 'unknown'),
            'file_size_bytes: '.($report['file_size_bytes'] ?? 'n/a'),
            'image_width: '.($report['image_width'] ?? 'n/a'),
            'image_height: '.($report['image_height'] ?? 'n/a'),
            'image_dpi: '.($report['image_dpi'] ?? 'n/a'),
            'mime_type: '.($report['mime_type'] ?? 'n/a'),
            '',
            '--- PREPROCESSING ---',
            'preprocess_steps: '.json_encode($report['preprocess_steps'] ?? [], JSON_UNESCAPED_SLASHES),
            'preprocessed_path: '.($report['preprocessed_path'] ?? 'n/a'),
            'debug_artifacts: '.json_encode($report['debug_artifacts'] ?? [], JSON_UNESCAPED_SLASHES),
            '',
            '--- OCR ENGINE ---',
            'engine: '.($report['engine'] ?? 'n/a'),
            'tesseract_oem: '.($report['tesseract_oem'] ?? 'n/a'),
            'tesseract_psm: '.($report['tesseract_psm'] ?? 'n/a'),
            'tesseract_command: '.($report['tesseract_command'] ?? 'n/a'),
            'execution_time_ms: '.($report['execution_time_ms'] ?? 'n/a'),
            'ocr_confidence: '.($report['ocr_confidence'] ?? 'n/a'),
            'multipass_report: '.json_encode($report['multipass_report'] ?? [], JSON_UNESCAPED_SLASHES),
            '',
            '--- RAW OCR OUTPUT ---',
            'text_length: '.($report['text_length'] ?? 0),
            'raw_ocr_output:',
            $report['raw_ocr_output'] ?? '[empty]',
            '',
            '--- PARSER ---',
            'parser_version: '.($report['parser_version'] ?? 'n/a'),
            'parser_status: '.($report['parser_status'] ?? 'n/a'),
            'regex_matches: '.json_encode($report['regex_matches'] ?? [], JSON_UNESCAPED_SLASHES),
            'parsed_fields: '.json_encode($report['parsed_fields'] ?? [], JSON_UNESCAPED_SLASHES),
            'field_confidence: '.json_encode($report['field_confidence'] ?? [], JSON_UNESCAPED_SLASHES),
            'review_suggestions: '.json_encode($report['review_suggestions'] ?? [], JSON_UNESCAPED_SLASHES),
            '',
            '--- DATASET MAPPING ---',
            'mapped_dataset: '.json_encode($report['mapped_dataset'] ?? [], JSON_UNESCAPED_SLASHES),
            'database_values: '.json_encode($report['database_values'] ?? [], JSON_UNESCAPED_SLASHES),
            '',
            '--- VALIDATION ---',
            'validation_results: '.json_encode($report['validation_results'] ?? [], JSON_UNESCAPED_SLASHES),
            '',
            '--- PIPELINE STATUS ---',
            ($report['ocr_executed'] ?? false ? '✓' : '✗').' OCR executed',
            ($report['text_extracted'] ?? false ? '✓' : '✗').' Text extracted',
            ($report['parser_executed'] ?? false ? '✓' : '✗').' Parser executed',
            ($report['dataset_mapping_ok'] ?? false ? '✓' : '✗').' Dataset mapping',
            'processing_status: '.($report['processing_status'] ?? 'unknown'),
            'failure_stage: '.($report['failure_stage'] ?? 'none'),
            'error_message: '.($report['error_message'] ?? 'none'),
            '',
        ];

        $content = implode(PHP_EOL, $lines);

        try {
            @file_put_contents(storage_path('logs/ocr-debug.log'), $content.PHP_EOL, FILE_APPEND);
        } catch (\Throwable $e) {
            Log::warning('Failed to write OCR debug log', ['error' => $e->getMessage()]);
        }
    }
}
