<?php

return [

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

];
