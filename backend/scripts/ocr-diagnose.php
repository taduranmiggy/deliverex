<?php
/**
 * Run OCR on latest (or given) document without tinker.
 * Usage:
 *   php scripts/ocr-diagnose.php
 *   php scripts/ocr-diagnose.php 19
 *   php scripts/ocr-diagnose.php --ping
 */
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

function ocr_diag_line(string $message): void
{
    echo $message."\n";
    if (function_exists('ob_flush')) {
        @ob_flush();
    }
    flush();
}

function ocr_diag_health_ping(): int
{
    $url = trim((string) config('ocr.remote_url'));
    if ($url === '') {
        ocr_diag_line('HEALTH=skip (OCR_REMOTE_URL empty)');

        return 0;
    }

    $healthUrl = preg_replace('#/ocr/?$#i', '/health', $url) ?: $url;
    ocr_diag_line('HEALTH_URL='.$healthUrl);

    $started = microtime(true);
    try {
        $response = Illuminate\Support\Facades\Http::timeout(45)
            ->connectTimeout(15)
            ->acceptJson()
            ->get($healthUrl);
        $elapsed = round(microtime(true) - $started, 2);
        ocr_diag_line('HEALTH_HTTP='.$response->status().' ELAPSED='.$elapsed.'s');
        ocr_diag_line('HEALTH_BODY='.substr(trim($response->body()), 0, 240));

        return $response->successful() ? 0 : 3;
    } catch (Throwable $e) {
        $elapsed = round(microtime(true) - $started, 2);
        ocr_diag_line('HEALTH_ERROR='.$e->getMessage().' ELAPSED='.$elapsed.'s');

        return 4;
    }
}

$args = array_slice($argv, 1);
$pingOnly = in_array('--ping', $args, true);
$docIdArg = null;
foreach ($args as $arg) {
    if ($arg === '--ping') {
        continue;
    }
    if (ctype_digit((string) $arg)) {
        $docIdArg = (int) $arg;
    }
}

ocr_diag_line('OCR_ENGINE='.config('ocr.engine'));
ocr_diag_line('OCR_PROVIDER='.config('ocr.provider'));
ocr_diag_line('OCR_SYNC_MODE='.(config('ocr.sync_mode') ? 'true' : 'false'));
ocr_diag_line('OCR_DEBUG_MODE='.(config('ocr.debug_mode') ? 'true' : 'false'));

$googleProject = trim((string) config('services.document_ai.project', ''));
$googleProcessor = trim((string) config('services.document_ai.processor_id', ''));
$googleLocation = trim((string) config('services.document_ai.location', 'us'));
$googleCredentials = trim((string) config('services.document_ai.credentials', ''));
$googleCredentialsPath = $googleCredentials !== ''
    ? (str_starts_with(str_replace('\\', '/', $googleCredentials), '/')
        || preg_match('/^[A-Za-z]:\//', str_replace('\\', '/', $googleCredentials)) === 1
        ? $googleCredentials
        : base_path($googleCredentials))
    : '';
ocr_diag_line('GOOGLE_PROJECT='.($googleProject !== '' ? $googleProject : 'unset'));
ocr_diag_line('GOOGLE_PROCESSOR='.($googleProcessor !== '' ? $googleProcessor : 'unset'));
ocr_diag_line('GOOGLE_LOCATION='.$googleLocation);
ocr_diag_line('GOOGLE_CREDENTIALS_PATH='.($googleCredentialsPath !== '' ? $googleCredentialsPath : 'unset'));
ocr_diag_line('GOOGLE_CREDENTIALS_READABLE='.($googleCredentialsPath !== '' && is_readable($googleCredentialsPath) ? 'yes' : 'no'));
$remoteUrl = trim((string) config('ocr.remote_url'));
ocr_diag_line('REMOTE_HOST='.(parse_url($remoteUrl, PHP_URL_HOST) ?: 'unset'));
ocr_diag_line('REMOTE_TIMEOUT='.max(10, (int) config('ocr.remote_timeout', 180)).'s');

if (strtolower((string) config('ocr.engine')) === 'remote') {
    ocr_diag_line('--- remote health check ---');
    $healthCode = ocr_diag_health_ping();
    if ($pingOnly) {
        exit($healthCode);
    }
    if ($healthCode !== 0) {
        ocr_diag_line('WARN=remote health check failed; OCR call may hang or fail');
    }
}

if ($pingOnly) {
    exit(0);
}

$doc = $docIdArg
    ? App\Models\DeliveryDocument::query()->find($docIdArg)
    : App\Models\DeliveryDocument::query()->latest()->first();

if (! $doc) {
    fwrite(STDERR, "NO_DOC\n");
    exit(1);
}

ocr_diag_line('DOC_ID='.$doc->id);
ocr_diag_line('FILE='.($doc->file_path ?? 'null'));
ocr_diag_line('FILE_EXISTS='.(Illuminate\Support\Facades\Storage::disk('public')->exists($doc->file_path) ? 'yes' : 'no'));

$diskPath = Illuminate\Support\Facades\Storage::disk('public')->path($doc->file_path);
if (strtolower((string) config('ocr.provider')) === 'document_ai' && is_readable($diskPath)) {
    ocr_diag_line('--- google document ai probe ---');
    $googleStarted = microtime(true);
    try {
        $googlePayload = app(App\Services\Ocr\GoogleDocumentAiService::class)->extractFromImage($diskPath);
        ocr_diag_line('GOOGLE_PROBE=ok ELAPSED='.round(microtime(true) - $googleStarted, 2).'s');
        ocr_diag_line('GOOGLE_TEXT_LEN='.strlen(trim((string) ($googlePayload['text'] ?? ''))));
        ocr_diag_line('GOOGLE_ENGINE='.($googlePayload['engine'] ?? 'null'));
    } catch (Throwable $e) {
        ocr_diag_line('GOOGLE_PROBE=fail ELAPSED='.round(microtime(true) - $googleStarted, 2).'s');
        ocr_diag_line('GOOGLE_ERROR='.$e->getMessage());
    }
}

$svc = app(App\Services\Ocr\OcrService::class);
$svc->createPending($doc);

ocr_diag_line('PROCESSING=started (remote OCR can take 30-180s on cold start)...');

$started = microtime(true);
try {
    $res = $svc->process($doc->fresh());
    ocr_diag_line('ELAPSED='.round(microtime(true) - $started, 2).'s');
    ocr_diag_line("STATUS={$res->processing_status}");
    ocr_diag_line('ERROR='.($res->error_message ?? 'none'));
    ocr_diag_line('DR='.($res->delivery_receipt_number ?? 'null'));
    ocr_diag_line('L='.($res->extracted_length ?? 'null'));
    ocr_diag_line('W='.($res->extracted_width ?? 'null'));
    ocr_diag_line('H='.($res->extracted_height ?? 'null'));
    ocr_diag_line('V='.($res->extracted_volume ?? 'null'));
    ocr_diag_line('ENGINE='.($res->engine ?? 'null'));
    ocr_diag_line('DIAG='.json_encode($res->ocr_diagnostics, JSON_UNESCAPED_SLASHES));
} catch (Throwable $e) {
    ocr_diag_line('ELAPSED='.round(microtime(true) - $started, 2).'s');
    ocr_diag_line('EXCEPTION='.$e->getMessage());
    exit(2);
}

$debugLog = storage_path('logs/ocr-debug.log');
ocr_diag_line('DEBUG_LOG='.$debugLog);
if (is_file($debugLog)) {
    ocr_diag_line('----- last 40 lines ocr-debug.log -----');
    $lines = file($debugLog, FILE_IGNORE_NEW_LINES);
    if (is_array($lines)) {
        foreach (array_slice($lines, -40) as $line) {
            ocr_diag_line($line);
        }
    }
} else {
    ocr_diag_line('ocr-debug.log not found yet');
}
