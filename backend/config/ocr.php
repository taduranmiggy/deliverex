<?php

return [

    /*
    |--------------------------------------------------------------------------
    | OCR engine
    |--------------------------------------------------------------------------
    |
    | local  - use a Tesseract binary available to this Laravel server.
    | remote - send images to an external OCR HTTP service, such as Render.
    |
    */
    'engine' => env('OCR_ENGINE', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Primary OCR provider
    |--------------------------------------------------------------------------
    |
    | document_ai - Google Cloud Document AI (primary).
    | local       - direct Tesseract only.
    |
    | When document_ai is selected and Google fails, OcrService automatically
    | falls back to the existing OCR_ENGINE flow (local/remote).
    |
    */
    'provider' => env('OCR_PROVIDER', 'document_ai'),

    /*
    |--------------------------------------------------------------------------
    | Tesseract binary path
    |--------------------------------------------------------------------------
    |
    | Full path to tesseract.exe (Windows) or tesseract (Linux/macOS).
    | Use forward slashes on Windows in .env, e.g.:
    | TESSERACT_PATH="C:/Program Files/Tesseract-OCR/tesseract.exe"
    |
    */
    'tesseract_path' => env('TESSERACT_PATH'),

    /*
    |--------------------------------------------------------------------------
    | Remote OCR service
    |--------------------------------------------------------------------------
    |
    | OCR_REMOTE_URL should point directly to the remote /ocr endpoint.
    | OCR_REMOTE_TOKEN is sent as a Bearer token.
    |
    */
    'remote_url' => env('OCR_REMOTE_URL'),
    'remote_token' => env('OCR_REMOTE_TOKEN'),
    'remote_timeout' => (int) env('OCR_REMOTE_TIMEOUT', 180),
    'remote_psm_candidates' => array_values(array_filter(array_map('trim', explode(',', (string) env('OCR_REMOTE_PSM_CANDIDATES', '6,11,7'))))),
    'remote_max_variants' => (int) env('OCR_REMOTE_MAX_VARIANTS', 4),
    'remote_enable_deskew' => filter_var(env('OCR_REMOTE_ENABLE_DESKEW', true), FILTER_VALIDATE_BOOLEAN),
    'remote_enable_morph' => filter_var(env('OCR_REMOTE_ENABLE_MORPH', true), FILTER_VALIDATE_BOOLEAN),

    'diagnostics_enabled' => filter_var(env('OCR_DIAGNOSTICS_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
    'debug_mode' => filter_var(env('OCR_DEBUG_MODE', true), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Synchronous OCR (demo-safe)
    |--------------------------------------------------------------------------
    |
    | When true (default), OCR runs immediately after upload — no queue worker
    | required. Set to false to dispatch ProcessDeliveryDocumentOcr to the queue
    | (requires: php artisan queue:work).
    |
    */
    'sync_mode' => filter_var(env('OCR_SYNC_MODE', true), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Stub fallback (local demo only)
    |--------------------------------------------------------------------------
    |
    | When true AND APP_ENV=local, missing Tesseract returns placeholder text
    | instead of failing. Never enable in production.
    |
    */
    'stub_fallback' => filter_var(env('OCR_STUB_FALLBACK', false), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Image preprocessing (GD)
    |--------------------------------------------------------------------------
    |
    | When enabled, images are lightly preprocessed before Google Document AI.
    | Gracefully skipped when GD or EXIF is unavailable.
    |
    */
    'preprocess_enabled' => filter_var(env('OCR_PREPROCESS_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Confidence scoring weights (weighted-v1)
    |--------------------------------------------------------------------------
    */
    'confidence_weights' => [
        'provider_ocr' => 0.28,
        'text_quality' => 0.07,
        'dimension_extraction' => 0.18,
        'receipt_pattern' => 0.12,
        'field_completeness' => 0.20,
        'volume_cross_validation' => 0.08,
        'table_detection' => 0.04,
        'auxiliary_fields' => 0.03,
    ],

];
