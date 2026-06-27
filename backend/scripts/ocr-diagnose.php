<?php
/**
 * Run OCR on latest (or given) document without tinker.
 * Usage:
 *   php scripts/ocr-diagnose.php
 *   php scripts/ocr-diagnose.php 19
 */
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$docId = isset($argv[1]) ? (int) $argv[1] : null;
$doc = $docId
    ? App\Models\DeliveryDocument::query()->find($docId)
    : App\Models\DeliveryDocument::query()->latest()->first();

if (! $doc) {
    fwrite(STDERR, "NO_DOC\n");
    exit(1);
}

echo "DOC_ID={$doc->id}\n";
echo 'FILE='.($doc->file_path ?? 'null')."\n";
echo 'FILE_EXISTS='.(Illuminate\Support\Facades\Storage::disk('public')->exists($doc->file_path) ? 'yes' : 'no')."\n";
echo 'OCR_ENGINE='.config('ocr.engine')."\n";
echo 'OCR_SYNC_MODE='.(config('ocr.sync_mode') ? 'true' : 'false')."\n";
echo 'OCR_DEBUG_MODE='.(config('ocr.debug_mode') ? 'true' : 'false')."\n";

$svc = app(App\Services\Ocr\OcrService::class);
$svc->createPending($doc);

try {
    $res = $svc->process($doc->fresh());
    echo "STATUS={$res->processing_status}\n";
    echo 'ERROR='.($res->error_message ?? 'none')."\n";
    echo 'DR='.($res->delivery_receipt_number ?? 'null')."\n";
    echo 'L='.($res->extracted_length ?? 'null')."\n";
    echo 'W='.($res->extracted_width ?? 'null')."\n";
    echo 'H='.($res->extracted_height ?? 'null')."\n";
    echo 'V='.($res->extracted_volume ?? 'null')."\n";
    echo 'ENGINE='.($res->engine ?? 'null')."\n";
    echo 'DIAG='.json_encode($res->ocr_diagnostics, JSON_UNESCAPED_SLASHES)."\n";
} catch (Throwable $e) {
    echo 'EXCEPTION='.$e->getMessage()."\n";
    exit(2);
}

$debugLog = storage_path('logs/ocr-debug.log');
echo 'DEBUG_LOG='.($debugLog)."\n";
if (is_file($debugLog)) {
    echo "----- last 40 lines ocr-debug.log -----\n";
    $lines = file($debugLog, FILE_IGNORE_NEW_LINES);
    if (is_array($lines)) {
        foreach (array_slice($lines, -40) as $line) {
            echo $line."\n";
        }
    }
} else {
    echo "ocr-debug.log not found yet\n";
}
