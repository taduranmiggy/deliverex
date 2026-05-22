<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Tesseract binary path
    |--------------------------------------------------------------------------
    |
    | Full path to tesseract.exe (Windows) or tesseract (Linux/macOS).
    | Use this when Tesseract is on your user PATH but PHP was started before
    | PATH was updated, or when the installer used a non-standard folder.
    |
    | Example (Windows): C:\Program Files\Tesseract-OCR\tesseract.exe
    |
    */
    'tesseract_path' => env('TESSERACT_PATH'),

];
