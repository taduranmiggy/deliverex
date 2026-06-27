<?php

namespace App\Services\Ocr;

use App\Models\DeliveryDocument;
use App\Models\OcrResult;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Throwable;

class OcrService
{
    public const STATUS_PENDING      = 'pending';
    public const STATUS_PROCESSING   = 'processing';
    public const STATUS_PROCESSED    = 'processed';
    public const STATUS_FAILED       = 'failed';
    public const STATUS_NEEDS_REVIEW = 'needs_review';
    public const STATUS_VALIDATED    = 'validated';

    /** Legacy alias kept for older rows */
    public const STATUS_COMPLETED = 'completed';

    /**
     * Create a placeholder result used before OCR runs.
     */
    public function createPending(DeliveryDocument $document): OcrResult
    {
        $system = $this->buildSystemContext($document);

        return OcrResult::query()->updateOrCreate(
            ['document_id' => $document->id],
            [
                'processing_status' => self::STATUS_PENDING,
                'review_status'     => 'pending_review',
                'extracted_text'    => null,
                'corrected_text'    => null,
                'extracted_length'  => null,
                'extracted_width'   => null,
                'extracted_height'  => null,
                'extracted_volume'  => null,
                'delivery_receipt_number' => null,
                'assignment_id'     => $system['assignment_id'],
                'job_order_id'      => $system['job_order_id'],
                'driver_id'         => $system['driver_id'],
                'driver_name'       => $system['driver_name'],
                'vehicle_plate_no'  => $system['vehicle_plate_no'],
                'delivery_date'     => $system['delivery_date'],
                'confidence_score'  => null,
                'engine'            => null,
                'ocr_diagnostics'   => null,
                'error_message'     => null,
                'review_notes'      => null,
                'reviewed_at'       => null,
                'is_validated'      => false,
            ]
        );
    }

    /**
     * Run extraction synchronously (upload handler, queue worker, or reprocess).
     */
    public function process(DeliveryDocument $document): OcrResult
    {
        $document->refresh();
        $result = $document->ocrResult;
        if (! $result) {
            $result = $this->createPending($document);
        }

        $result->forceFill([
            'processing_status' => self::STATUS_PROCESSING,
            'error_message'     => null,
        ])->save();

        $diskPath = Storage::disk('public')->path($document->file_path);

        if (! Storage::disk('public')->exists($document->file_path)) {
            return $this->fail(
                $result,
                'Stored file not found at '.$document->file_path.'. Run: php artisan storage:link'
            );
        }

        if (! is_readable($diskPath)) {
            return $this->fail(
                $result,
                'Stored file is not readable. Ensure storage/app/public is linked (php artisan storage:link).'
            );
        }

        $ext = strtolower(pathinfo($diskPath, PATHINFO_EXTENSION));
        if ($ext === 'pdf') {
            return $this->fail(
                $result,
                'PDF OCR is not enabled. Please upload JPG or PNG images.'
            );
        }

        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tif', 'tiff', 'bmp'], true)) {
            return $this->fail($result, 'Unsupported image type for OCR: '.$ext);
        }

        if ($this->usesRemoteEngine()) {
            return $this->processWithRemoteService($result, $document, $diskPath);
        }

        $tesseract = $this->resolveTesseractBinary();
        if (! $tesseract) {
            $message = 'Tesseract OCR is not installed or not configured. '
                .'Install Tesseract and set TESSERACT_PATH in .env, then run: php artisan ocr:check';

            if ($this->stubFallbackEnabled()) {
                Log::warning('Tesseract not found; using local stub fallback.', ['document_id' => $document->id]);

                return $this->stubExtraction($result, $document, $diskPath, $message);
            }

            return $this->fail($result, $message);
        }

        try {
            $process = new Process([$tesseract, $diskPath, 'stdout', '-l', 'eng', '--psm', '6']);
            $process->setTimeout(120);
            $process->run();

            if (! $process->isSuccessful()) {
                $err = trim($process->getErrorOutput() ?: $process->getOutput() ?: 'Tesseract failed.');

                return $this->fail($result, $err);
            }

            return $this->persistExtraction(
                $result,
                $document,
                trim($process->getOutput()),
                null,
                'tesseract'
            );
        } catch (Throwable $e) {
            Log::error('OCR processing exception', ['document_id' => $document->id, 'error' => $e->getMessage()]);

            return $this->fail($result, $e->getMessage());
        }
    }

    public function isTesseractAvailable(): bool
    {
        return $this->resolveTesseractBinary() !== null;
    }

    private function usesRemoteEngine(): bool
    {
        return strtolower((string) config('ocr.engine', 'local')) === 'remote';
    }

    private function processWithRemoteService(OcrResult $result, DeliveryDocument $document, string $diskPath): OcrResult
    {
        $url = trim((string) config('ocr.remote_url'));
        $token = trim((string) config('ocr.remote_token'));
        $timeout = max(10, (int) config('ocr.remote_timeout', 180));

        if ($url === '') {
            return $this->fail($result, 'Remote OCR is enabled but OCR_REMOTE_URL is not configured.');
        }

        if ($token === '') {
            return $this->fail($result, 'Remote OCR is enabled but OCR_REMOTE_TOKEN is not configured.');
        }

        $handle = @fopen($diskPath, 'r');
        if (! $handle) {
            return $this->fail($result, 'Could not open stored file for remote OCR.');
        }

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withToken($token)
                ->attach('file', $handle, basename($diskPath))
                ->withHeaders([
                    'X-OCR-PSM-Candidates' => implode(',', (array) config('ocr.remote_psm_candidates', [])),
                    'X-OCR-Max-Variants' => (string) config('ocr.remote_max_variants', 4),
                    'X-OCR-Enable-Deskew' => config('ocr.remote_enable_deskew', true) ? 'true' : 'false',
                    'X-OCR-Enable-Morph' => config('ocr.remote_enable_morph', true) ? 'true' : 'false',
                ])
                ->post($url);
        } catch (Throwable $e) {
            fclose($handle);
            Log::error('Remote OCR request failed', ['document_id' => $document->id, 'error' => $e->getMessage()]);

            return $this->fail($result, 'Remote OCR request failed: '.$e->getMessage());
        }

        fclose($handle);

        if (! $response->successful()) {
            $message = $response->json('detail')
                ?: $response->json('message')
                ?: trim($response->body())
                ?: 'Remote OCR service returned HTTP '.$response->status();

            return $this->fail($result, 'Remote OCR failed: '.$message);
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return $this->fail($result, 'Remote OCR returned an invalid JSON response.');
        }

        $text = trim((string) ($payload['text'] ?? ''));
        $confidence = is_numeric($payload['confidence'] ?? null)
            ? (float) $payload['confidence']
            : null;
        $engine = trim((string) ($payload['engine'] ?? 'render-tesseract')) ?: 'render-tesseract';
        $diagnostics = is_array($payload['diagnostics'] ?? null) ? $payload['diagnostics'] : [];

        return $this->persistExtraction($result, $document, $text, $confidence, $engine, $diagnostics);
    }

    private function persistExtraction(
        OcrResult $result,
        DeliveryDocument $document,
        string $text,
        ?float $confidence,
        string $engine,
        array $diagnostics = [],
    ): OcrResult {
        $confidence ??= $this->estimateConfidence($text);
        $displayText = $text !== '' ? $text : '(No text detected — image may be blank or low contrast.)';
        $structured = $this->extractStructuredFields($text);
        $system = $this->buildSystemContext($document);
        $hasStructured = $structured['length'] !== null
            || $structured['width'] !== null
            || $structured['height'] !== null
            || $structured['volume'] !== null
            || $structured['delivery_receipt_number'] !== null;

        $status = self::STATUS_PROCESSED;
        if ($text === '' || ($confidence !== null && $confidence < 0.65) || ! $hasStructured) {
            $status = self::STATUS_NEEDS_REVIEW;
        }

        $diagnostics = $this->buildDiagnostics($diagnostics, $text, $confidence, $structured);

        $result->forceFill([
            'processing_status'  => $status,
            'review_status'      => 'pending_review',
            'extracted_text'     => $displayText,
            'corrected_text'     => null,
            'extracted_length'   => $structured['length'],
            'extracted_width'    => $structured['width'],
            'extracted_height'   => $structured['height'],
            'extracted_volume'   => $structured['volume'],
            'delivery_receipt_number' => $structured['delivery_receipt_number'],
            'assignment_id'      => $system['assignment_id'],
            'job_order_id'       => $system['job_order_id'],
            'driver_id'          => $system['driver_id'],
            'driver_name'        => $system['driver_name'],
            'vehicle_plate_no'   => $system['vehicle_plate_no'],
            'delivery_date'      => $system['delivery_date'],
            'confidence_score'   => $confidence,
            'engine'             => $engine,
            'ocr_diagnostics'    => config('ocr.diagnostics_enabled', true) ? $diagnostics : null,
            'error_message'      => null,
        ])->save();

        return $result->fresh();
    }

    /**
     * Locate Tesseract — honors TESSERACT_PATH, PATH, and common install dirs.
     */
    private function resolveTesseractBinary(): ?string
    {
        $configured = config('ocr.tesseract_path');
        if (is_string($configured) && $configured !== '') {
            $configured = $this->normalizeBinaryPath($configured);
            if ($this->isUsableBinary($configured)) {
                return $configured;
            }
            Log::warning('TESSERACT_PATH is set but not readable', ['path' => $configured]);
        }

        if (PHP_OS_FAMILY === 'Windows') {
            foreach (['tesseract.exe', 'tesseract'] as $name) {
                $fromWhere = $this->findViaWhere($name);
                if ($fromWhere) {
                    return $fromWhere;
                }
            }
        }

        $extraDirs = [
            'C:\\Program Files\\Tesseract-OCR',
            'C:\\Program Files (x86)\\Tesseract-OCR',
            '/usr/bin',
            '/usr/local/bin',
            '/opt/homebrew/bin',
        ];

        $finder = new ExecutableFinder;
        foreach (['tesseract', 'tesseract.exe'] as $name) {
            $found = $finder->find($name, null, $extraDirs);
            if ($found && $this->isUsableBinary($found)) {
                return $this->normalizeBinaryPath($found);
            }
        }

        $candidates = [
            'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
            'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
            '/usr/bin/tesseract',
            '/usr/local/bin/tesseract',
            '/opt/homebrew/bin/tesseract',
        ];

        foreach ($candidates as $path) {
            if ($this->isUsableBinary($path)) {
                return $path;
            }
        }

        return null;
    }

    private function normalizeBinaryPath(string $path): string
    {
        $path = trim($path, " \t\n\r\0\x0B\"'");

        if (PHP_OS_FAMILY === 'Windows' && ! str_ends_with(strtolower($path), '.exe') && is_dir($path)) {
            $joined = rtrim($path, '\\/').'\\tesseract.exe';
            if ($this->isUsableBinary($joined)) {
                return $joined;
            }
        }

        return $path;
    }

    /** On Windows, is_executable() is unreliable for .exe — use is_file instead. */
    private function isUsableBinary(string $path): bool
    {
        return is_file($path) && is_readable($path);
    }

    private function findViaWhere(string $name): ?string
    {
        try {
            $process = new Process(['where', $name]);
            $process->setTimeout(10);
            $process->run();

            if (! $process->isSuccessful()) {
                return null;
            }

            foreach (preg_split('/\R/', trim($process->getOutput())) as $line) {
                $line = trim($line);
                if ($line !== '' && $this->isUsableBinary($line)) {
                    return $line;
                }
            }
        } catch (Throwable) {
            // ignore
        }

        return null;
    }

    private function stubFallbackEnabled(): bool
    {
        return config('ocr.stub_fallback') && app()->environment('local');
    }

    /**
     * Optional local-only placeholder when Tesseract is missing (OCR_STUB_FALLBACK=true).
     */
    private function stubExtraction(OcrResult $result, DeliveryDocument $document, string $diskPath, string $errorHint): OcrResult
    {
        $size = @filesize($diskPath) ?: 0;
        $stub = implode("\n", [
            '[OCR stub — Tesseract not available]',
            $errorHint,
            '',
            'Document ID: '.$document->id,
            'Type: '.($document->type ?? 'document'),
            'File: '.basename($diskPath),
            'Size: '.$size.' bytes',
        ]);

        $result->forceFill([
            'processing_status'  => self::STATUS_NEEDS_REVIEW,
            'review_status'      => 'pending_review',
            'extracted_text'     => $stub,
            'corrected_text'     => null,
            'extracted_length'   => null,
            'extracted_width'    => null,
            'extracted_height'   => null,
            'extracted_volume'   => null,
            'delivery_receipt_number' => null,
            'confidence_score'   => null,
            'engine'             => 'stub',
            'error_message'      => $errorHint,
        ])->save();

        return $result->fresh();
    }

    private function estimateConfidence(string $text): ?float
    {
        if ($text === '' || str_starts_with($text, '(No text detected')) {
            return null;
        }

        $len = strlen($text);
        if ($len > 200) {
            return 0.88;
        }
        if ($len > 50) {
            return 0.75;
        }

        return 0.55;
    }

    private function fail(OcrResult $result, string $message): OcrResult
    {
        $result->forceFill([
            'processing_status' => self::STATUS_FAILED,
            'review_status'     => 'pending_review',
            'ocr_diagnostics'   => config('ocr.diagnostics_enabled', true)
                ? ['reason' => 'processing_error', 'message' => $message]
                : null,
            'error_message'     => $message,
        ])->save();

        return $result->fresh();
    }

    private function buildDiagnostics(array $upstream, string $text, ?float $confidence, array $structured): array
    {
        $parserStatus = 'parsed';
        if ($text === '') {
            $parserStatus = 'no_text';
        } elseif (
            $structured['length'] === null
            && $structured['width'] === null
            && $structured['height'] === null
            && $structured['volume'] === null
            && $structured['delivery_receipt_number'] === null
        ) {
            $parserStatus = 'parser_miss';
        } elseif (
            $structured['length'] === null
            || $structured['width'] === null
            || $structured['height'] === null
            || $structured['delivery_receipt_number'] === null
        ) {
            $parserStatus = 'partial';
        }

        return array_merge($upstream, [
            'parser_status' => $parserStatus,
            'text_length' => strlen($text),
            'structured_hits' => [
                'length' => $structured['length'] !== null,
                'width' => $structured['width'] !== null,
                'height' => $structured['height'] !== null,
                'volume' => $structured['volume'] !== null,
                'delivery_receipt_number' => $structured['delivery_receipt_number'] !== null,
            ],
            'confidence' => $confidence,
        ]);
    }

    private function extractStructuredFields(string $text): array
    {
        $normalized = $this->normalizeOcrText($text);

        $length = $this->extractMeasurement($normalized, [
            'length', 'len', 'lngth', 'lengt', '1ength', 'iength', 'l',
        ]);
        $width = $this->extractMeasurement($normalized, [
            'width', 'wid', 'wdth', 'w1dth', 'w',
        ]);
        $height = $this->extractMeasurement($normalized, [
            'height', 'hgt', 'he1ght', 'hieght', 'h',
        ]);
        $volume = $this->extractMeasurement($normalized, [
            'volume', 'vol', 'cbm', 'm3', 'cu m', 'cubic',
        ]);

        if ($length === null || $width === null || $height === null) {
            $dims = $this->extractInlineDimensions($normalized);
            $length ??= $dims['length'];
            $width ??= $dims['width'];
            $height ??= $dims['height'];
        }

        if ($length === null || $width === null || $height === null || $volume === null) {
            $tabular = $this->extractTabularDimensions($normalized);
            $length ??= $tabular['length'];
            $width ??= $tabular['width'];
            $height ??= $tabular['height'];
            if ($volume === null) {
                $volume = $tabular['volume'];
            } elseif ($tabular['volume'] !== null && $length !== null && $width !== null && $height !== null) {
                $calc = $length * $width * $height;
                $currentDelta = abs($volume - $calc) / max($calc, 0.0001);
                $tabularDelta = abs($tabular['volume'] - $calc) / max($calc, 0.0001);
                if ($tabularDelta < $currentDelta) {
                    $volume = $tabular['volume'];
                }
            }
        }

        if ($volume === null && $length !== null && $width !== null && $height !== null) {
            // Last-resort estimate when OCR captured dimensions but not explicit volume.
            $volume = round($length * $width * $height, 4);
        }

        return [
            'length' => $length,
            'width' => $width,
            'height' => $height,
            'volume' => $volume,
            'delivery_receipt_number' => $this->extractReceiptNumber($text),
        ];
    }

    private function extractMeasurement(string $text, array $labels): ?float
    {
        foreach ($labels as $label) {
            $pattern = '/(?:\b'.preg_quote($label, '/').'\b)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)(?:\s*(?:cm|mm|m|meter|meters|cbm|m3))?/i';
            if (preg_match($pattern, $text, $m)) {
                return $this->toFloat($m[1] ?? null);
            }
        }

        // Fallback: allow a nearby number after any provided label token.
        $escaped = array_map(static fn (string $label): string => preg_quote($label, '/'), $labels);
        if ($escaped !== []) {
            $nearbyPattern = '/(?:'.implode('|', $escaped).')[^\d]{0,8}([0-9]+(?:[.,][0-9]+)?)/i';
            if (preg_match($nearbyPattern, $text, $m)) {
                return $this->toFloat($m[1] ?? null);
            }
        }

        return null;
    }

    private function extractReceiptNumber(string $text): ?string
    {
        $patterns = [
            '/(?:delivery\s*receipt(?:\s*(?:no|number))?|receipt(?:\s*(?:no|number))?|delivery\s*no)\s*[:#-]?\s*([a-z]{1,4}[-\/]?[a-z0-9]{3,})/i',
            '/\b(dr[-\s]?[a-z0-9]{3,})\b/i',
            '/\bdr\s*[-:#]?\s*([a-z0-9]{3,})\b/i',
            '/\b([a-z]{1,4}[-\/]?[0-9]{4,})\b/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $m)) {
                $value = strtoupper(trim((string) ($m[1] ?? '')));
                if ($value === '') {
                    continue;
                }
                if (! str_starts_with($value, 'DR') && preg_match('/\bdr\b/i', $text)) {
                    $value = 'DR-'.$value;
                }
                if ($value === 'DR' || $value === 'DR-') {
                    continue;
                }

                return $value;
            }
        }

        return null;
    }

    private function extractInlineDimensions(string $text): array
    {
        $patterns = [
            '/\b([0-9]+(?:[.,][0-9]+)?)\s*[x×*]\s*([0-9]+(?:[.,][0-9]+)?)\s*[x×*]\s*([0-9]+(?:[.,][0-9]+)?)/i',
            '/\bdim(?:ension)?s?\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)\D+([0-9]+(?:[.,][0-9]+)?)\D+([0-9]+(?:[.,][0-9]+)?)/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $m)) {
                return [
                    'length' => $this->toFloat($m[1] ?? null),
                    'width' => $this->toFloat($m[2] ?? null),
                    'height' => $this->toFloat($m[3] ?? null),
                ];
            }
        }

        return ['length' => null, 'width' => null, 'height' => null];
    }

    private function extractTabularDimensions(string $text): array
    {
        $normalized = preg_replace('/\s+/', ' ', $text) ?? $text;
        if (! preg_match_all('/\b\d+(?:[.,]\d+)?\b/', $normalized, $matches)) {
            return ['length' => null, 'width' => null, 'height' => null, 'volume' => null];
        }

        $values = array_values(array_filter(array_map(fn ($v) => $this->toFloat($v), $matches[0]), static fn ($v) => $v !== null));
        if (count($values) < 3) {
            return ['length' => null, 'width' => null, 'height' => null, 'volume' => null];
        }

        // Heuristic: prefer quadruples where A*B*C ~= D (common L/W/H/V delivery table row).
        for ($i = 0; $i <= count($values) - 4; $i++) {
            $a = $values[$i];
            $b = $values[$i + 1];
            $c = $values[$i + 2];
            $d = $values[$i + 3];
            if ($a === null || $b === null || $c === null) {
                continue;
            }
            if ($a <= 0 || $b <= 0 || $c <= 0) {
                continue;
            }
            if ($a > 1000 || $b > 1000 || $c > 1000) {
                continue;
            }
            if ($d === null || $d <= 0 || $d > 100000) {
                continue;
            }
            $calc = $a * $b * $c;
            $ratio = abs($calc - $d) / max($d, 0.0001);
            if ($ratio > 0.35) {
                continue;
            }

            return [
                'length' => $a,
                'width' => $b,
                'height' => $c,
                'volume' => $d,
            ];
        }

        // Fallback: first sane triple if explicit volume match is unavailable.
        for ($i = 0; $i <= count($values) - 3; $i++) {
            $a = $values[$i];
            $b = $values[$i + 1];
            $c = $values[$i + 2];
            if ($a === null || $b === null || $c === null) {
                continue;
            }
            if ($a > 0 && $b > 0 && $c > 0 && $a <= 1000 && $b <= 1000 && $c <= 1000) {
                return [
                    'length' => $a,
                    'width' => $b,
                    'height' => $c,
                    'volume' => null,
                ];
            }
        }

        return ['length' => null, 'width' => null, 'height' => null, 'volume' => null];
    }

    private function normalizeOcrText(string $text): string
    {
        $normalized = strtolower($text);
        $normalized = str_replace(["\r\n", "\r"], "\n", $normalized);
        $normalized = str_replace(['|', '¦', '—', '_'], ['1', '1', '-', '-'], $normalized);

        // Common OCR substitutions for labels.
        $normalized = preg_replace('/\b1ength\b/u', 'length', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bw1dth\b/u', 'width', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bhe1ght\b/u', 'height', $normalized) ?? $normalized;
        $normalized = preg_replace('/\brn\b/u', 'm', $normalized) ?? $normalized;

        return $normalized;
    }

    private function toFloat(mixed $value): ?float
    {
        if (! is_scalar($value)) {
            return null;
        }
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $normalized = str_replace(',', '.', $raw);
        $normalized = preg_replace('/[^0-9.]/', '', $normalized);
        if (! is_string($normalized) || $normalized === '' || ! is_numeric($normalized)) {
            return null;
        }

        return (float) $normalized;
    }

    private function buildSystemContext(DeliveryDocument $document): array
    {
        $document->loadMissing('assignment.driver.user', 'assignment.vehicle', 'assignment.jobOrder');
        $assignment = $document->assignment;

        return [
            'assignment_id' => $assignment?->id,
            'job_order_id' => $assignment?->job_order_id,
            'driver_id' => $assignment?->driver_id,
            'driver_name' => $assignment?->driver?->full_name ?: $assignment?->driver?->user?->name,
            'vehicle_plate_no' => $assignment?->vehicle?->plate_no,
            'delivery_date' => $assignment?->arrived_at ?: $assignment?->completed_at ?: now(),
        ];
    }
}
