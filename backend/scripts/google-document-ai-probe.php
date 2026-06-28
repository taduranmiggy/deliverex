<?php
/**
 * Probe Google Document AI connectivity (REST transport, credentials, API call).
 *
 * Usage:
 *   php scripts/google-document-ai-probe.php
 *   php scripts/google-document-ai-probe.php 19
 */
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

function probe_line(string $message): void
{
    echo $message.PHP_EOL;
    flush();
}

$docId = null;
foreach (array_slice($argv, 1) as $arg) {
    if (ctype_digit((string) $arg)) {
        $docId = (int) $arg;
    }
}

probe_line('PHP_VERSION='.PHP_VERSION);
probe_line('EXT_GRPC='.(extension_loaded('grpc') ? 'yes' : 'no'));
probe_line('EXT_CURL='.(extension_loaded('curl') ? 'yes' : 'no'));
probe_line('OCR_PROVIDER='.config('ocr.provider'));
probe_line('GOOGLE_PROJECT='.config('services.document_ai.project'));
probe_line('GOOGLE_PROCESSOR='.config('services.document_ai.processor_id'));
probe_line('GOOGLE_LOCATION='.config('services.document_ai.location'));
probe_line('DOCUMENT_AI_TRANSPORT='.config('services.document_ai.transport', 'rest'));
probe_line('DOCUMENT_AI_TIMEOUT='.config('services.document_ai.timeout', 30).'s');

$credentials = trim((string) config('services.document_ai.credentials', ''));
$credentialsPath = $credentials !== ''
    ? (str_starts_with(str_replace('\\', '/', $credentials), '/')
        || preg_match('/^[A-Za-z]:\//', str_replace('\\', '/', $credentials)) === 1
        ? $credentials
        : base_path($credentials))
    : '';
probe_line('CREDENTIALS_PATH='.($credentialsPath !== '' ? $credentialsPath : 'unset'));
probe_line('CREDENTIALS_READABLE='.($credentialsPath !== '' && is_readable($credentialsPath) ? 'yes' : 'no'));

$location = trim((string) config('services.document_ai.location', 'us'));
$healthHost = sprintf('%s-documentai.googleapis.com', $location);
probe_line('API_HOST='.$healthHost);

$dns = @gethostbyname($healthHost);
probe_line('DNS_RESOLVE='.($dns !== $healthHost ? $dns : 'failed'));

$curlStarted = microtime(true);
$ch = curl_init('https://'.$healthHost.'/');
curl_setopt_array($ch, [
    CURLOPT_NOBODY => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_CONNECTTIMEOUT => 10,
]);
curl_exec($ch);
$curlCode = (int) curl_errno($ch);
$curlError = (string) curl_error($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
probe_line('HTTPS_PROBE_HTTP='.$httpCode.' ELAPSED='.round(microtime(true) - $curlStarted, 2).'s');
if ($curlCode !== 0) {
    probe_line('HTTPS_PROBE_CURL_ERROR='.$curlError);
}

$doc = $docId
    ? App\Models\DeliveryDocument::query()->find($docId)
    : App\Models\DeliveryDocument::query()->latest()->first();

if (! $doc) {
    probe_line('DOC=missing');
    exit(1);
}

$diskPath = Illuminate\Support\Facades\Storage::disk('public')->path($doc->file_path);
probe_line('DOC_ID='.$doc->id);
probe_line('IMAGE_PATH='.$diskPath);
probe_line('IMAGE_READABLE='.(is_readable($diskPath) ? 'yes' : 'no'));

probe_line('--- document ai processDocument ---');
$started = microtime(true);
try {
    $payload = app(App\Services\Ocr\GoogleDocumentAiService::class)->extractFromImage($diskPath);
    $elapsed = round(microtime(true) - $started, 2);
    probe_line('RESULT=ok ELAPSED='.$elapsed.'s');
    probe_line('ENGINE='.($payload['engine'] ?? 'null'));
    probe_line('TEXT_LEN='.strlen(trim((string) ($payload['text'] ?? ''))));
    probe_line('CONFIDENCE='.($payload['confidence'] ?? 'null'));
    probe_line('DIAGNOSTICS='.json_encode($payload['diagnostics'] ?? [], JSON_UNESCAPED_SLASHES));
    exit(0);
} catch (Throwable $e) {
    $elapsed = round(microtime(true) - $started, 2);
    probe_line('RESULT=fail ELAPSED='.$elapsed.'s');
    probe_line('ERROR='.$e->getMessage());
    $previous = $e->getPrevious();
    if ($previous instanceof Throwable) {
        probe_line('PREVIOUS='.$previous->getMessage());
    }
    exit(2);
}
