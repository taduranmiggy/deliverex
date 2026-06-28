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

    public function __construct(
        private readonly GoogleDocumentAiService $googleDocumentAiService,
    ) {
    }

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
        $debugContext = $this->newDebugContext($document, $diskPath);

        if (! Storage::disk('public')->exists($document->file_path)) {
            return $this->fail(
                $result,
                'Stored file not found at '.$document->file_path.'. Run: php artisan storage:link',
                $debugContext
            );
        }

        if (! is_readable($diskPath)) {
            return $this->fail(
                $result,
                'Stored file is not readable. Ensure storage/app/public is linked (php artisan storage:link).',
                $debugContext
            );
        }

        $ext = strtolower(pathinfo($diskPath, PATHINFO_EXTENSION));
        if ($ext === 'pdf') {
            return $this->fail(
                $result,
                'PDF OCR is not enabled. Please upload JPG or PNG images.',
                $debugContext
            );
        }

        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tif', 'tiff', 'bmp'], true)) {
            return $this->fail($result, 'Unsupported image type for OCR: '.$ext, $debugContext);
        }

        if ($this->usesDocumentAiProvider()) {
            $googleResult = $this->processWithGoogleDocumentAi($result, $document, $diskPath, $debugContext);
            if ($googleResult instanceof OcrResult) {
                return $googleResult;
            }
        }

        if ($this->usesRemoteEngine()) {
            return $this->processWithRemoteService($result, $document, $diskPath, $debugContext);
        }

        $tesseract = $this->resolveTesseractBinary();
        if (! $tesseract) {
            $message = 'Tesseract OCR is not installed or not configured. '
                .'Install Tesseract and set TESSERACT_PATH in .env, then run: php artisan ocr:check';

            if ($this->stubFallbackEnabled()) {
                Log::warning('Tesseract not found; using local stub fallback.', ['document_id' => $document->id]);

                return $this->stubExtraction($result, $document, $diskPath, $message);
            }

            return $this->fail($result, $message, $debugContext);
        }

        try {
            $cmd = [$tesseract, $diskPath, 'stdout', '--oem', '3', '-l', 'eng', '--psm', '6'];
            $process = new Process($cmd);
            $process->setTimeout(120);
            $process->run();
            $debugContext['tesseract_command'] = implode(' ', $cmd);

            if (! $process->isSuccessful()) {
                $err = trim($process->getErrorOutput() ?: $process->getOutput() ?: 'Tesseract failed.');

                return $this->fail($result, $err, $debugContext);
            }

            return $this->persistExtraction(
                $result,
                $document,
                trim($process->getOutput()),
                null,
                'tesseract',
                [],
                $debugContext
            );
        } catch (Throwable $e) {
            Log::error('OCR processing exception', ['document_id' => $document->id, 'error' => $e->getMessage()]);

            return $this->fail($result, $e->getMessage(), $debugContext);
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

    private function usesDocumentAiProvider(): bool
    {
        return strtolower((string) config('ocr.provider', 'document_ai')) === 'document_ai';
    }

    private function processWithGoogleDocumentAi(OcrResult $result, DeliveryDocument $document, string $diskPath, array $debugContext): ?OcrResult
    {
        try {
            $payload = $this->googleDocumentAiService->extractFromImage($diskPath);
        } catch (Throwable $e) {
            $debugContext['google_document_ai_error'] = $e->getMessage();
            Log::warning('Google Document AI failed, falling back to legacy OCR.', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        if (! is_array($payload)) {
            $debugContext['google_document_ai_error'] = 'Google Document AI returned a malformed payload.';
            Log::warning('Google Document AI returned malformed payload, falling back to legacy OCR.', [
                'document_id' => $document->id,
            ]);

            return null;
        }

        $text = trim((string) ($payload['text'] ?? ''));
        $confidence = is_numeric($payload['confidence'] ?? null)
            ? (float) $payload['confidence']
            : null;
        $engine = trim((string) ($payload['engine'] ?? 'google-document-ai')) ?: 'google-document-ai';
        $diagnostics = is_array($payload['diagnostics'] ?? null) ? $payload['diagnostics'] : [];

        $debugContext['tesseract_command'] = (string) ($payload['command'] ?? 'google.documentai.processDocument');
        $debugContext['preprocessed_path'] = (string) ($payload['preprocessed_image_path'] ?? '');

        return $this->persistExtraction($result, $document, $text, $confidence, $engine, $diagnostics, $debugContext);
    }

    private function processWithRemoteService(OcrResult $result, DeliveryDocument $document, string $diskPath, array $debugContext): OcrResult
    {
        $url = trim((string) config('ocr.remote_url'));
        $token = trim((string) config('ocr.remote_token'));
        $timeout = max(10, (int) config('ocr.remote_timeout', 180));

        if ($url === '') {
            return $this->fail($result, 'Remote OCR is enabled but OCR_REMOTE_URL is not configured.', $debugContext);
        }

        if ($token === '') {
            return $this->fail($result, 'Remote OCR is enabled but OCR_REMOTE_TOKEN is not configured.', $debugContext);
        }

        $handle = @fopen($diskPath, 'r');
        if (! $handle) {
            return $this->fail($result, 'Could not open stored file for remote OCR.', $debugContext);
        }

        try {
            $response = Http::timeout($timeout)
                ->connectTimeout(15)
                ->acceptJson()
                ->withToken($token)
                ->attach('file', $handle, basename($diskPath))
                ->withHeaders([
                    'X-OCR-PSM-Candidates' => implode(',', (array) config('ocr.remote_psm_candidates', [])),
                    'X-OCR-OEM-Candidates' => '3',
                    'X-OCR-Max-Variants' => (string) config('ocr.remote_max_variants', 4),
                    'X-OCR-Enable-Deskew' => config('ocr.remote_enable_deskew', true) ? 'true' : 'false',
                    'X-OCR-Enable-Morph' => config('ocr.remote_enable_morph', true) ? 'true' : 'false',
                ])
                ->post($url);
        } catch (Throwable $e) {
            fclose($handle);
            Log::error('Remote OCR request failed', ['document_id' => $document->id, 'error' => $e->getMessage()]);

            return $this->fail($result, 'Remote OCR request failed: '.$e->getMessage(), $debugContext);
        }

        fclose($handle);

        if (! $response->successful()) {
            $message = $response->json('detail')
                ?: $response->json('message')
                ?: trim(strip_tags($response->body()))
                ?: 'Remote OCR service returned HTTP '.$response->status();

            if ($response->status() === 502) {
                $message .= ' Render OCR service is down or failed to start. Redeploy the Render web service and check its logs.';
            }

            return $this->fail($result, 'Remote OCR failed: '.$message, $debugContext);
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return $this->fail($result, 'Remote OCR returned an invalid JSON response.', $debugContext);
        }

        $text = trim((string) ($payload['text'] ?? ''));
        $confidence = is_numeric($payload['confidence'] ?? null)
            ? (float) $payload['confidence']
            : null;
        $engine = trim((string) ($payload['engine'] ?? 'render-tesseract')) ?: 'render-tesseract';
        $diagnostics = $this->mergeGoogleFallbackDiagnostics(
            is_array($payload['diagnostics'] ?? null) ? $payload['diagnostics'] : [],
            $debugContext
        );

        $debugContext['tesseract_command'] = (string) ($payload['command'] ?? 'remote:multipass');
        $debugContext['preprocessed_path'] = (string) ($payload['preprocessed_image_path'] ?? '');

        return $this->persistExtraction($result, $document, $text, $confidence, $engine, $diagnostics, $debugContext);
    }

    /**
     * @param  array<string, mixed>  $diagnostics
     * @param  array<string, mixed>  $debugContext
     * @return array<string, mixed>
     */
    private function mergeGoogleFallbackDiagnostics(array $diagnostics, array $debugContext): array
    {
        $googleError = trim((string) ($debugContext['google_document_ai_error'] ?? ''));
        if ($googleError !== '') {
            $diagnostics['google_document_ai_fallback'] = $googleError;
        }

        return $diagnostics;
    }

    private function persistExtraction(
        OcrResult $result,
        DeliveryDocument $document,
        string $text,
        ?float $confidence,
        string $engine,
        array $diagnostics = [],
        array $debugContext = [],
    ): OcrResult {
        $confidence ??= $this->estimateConfidence($text);
        $displayText = $text !== '' ? $text : '(No text detected — image may be blank or low contrast.)';
        $parsed = $this->extractStructuredFieldsWithDebug($text);
        $structured = $parsed['values'];
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

        $diagnostics = $this->buildDiagnostics(
            $diagnostics,
            $text,
            $confidence,
            $structured,
            $parsed['matches'],
            $parsed['meta'] ?? []
        );

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

        $this->writeDebugReport($result->fresh(), $debugContext, $text, $confidence, $parsed['matches'], $structured);

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

    private function fail(OcrResult $result, string $message, array $debugContext = []): OcrResult
    {
        $result->forceFill([
            'processing_status' => self::STATUS_FAILED,
            'review_status'     => 'pending_review',
            'ocr_diagnostics'   => config('ocr.diagnostics_enabled', true)
                ? ['reason' => 'processing_error', 'message' => $message]
                : null,
            'error_message'     => $message,
        ])->save();

        $this->writeDebugReport($result->fresh(), $debugContext, '', null, [], [
            'length' => null,
            'width' => null,
            'height' => null,
            'volume' => null,
            'delivery_receipt_number' => null,
        ], $message);

        return $result->fresh();
    }

    private function buildDiagnostics(
        array $upstream,
        string $text,
        ?float $confidence,
        array $structured,
        array $regexMatches,
        array $parserMeta = []
    ): array
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
            'regex_matches' => $regexMatches,
            'structured_hits' => [
                'length' => $structured['length'] !== null,
                'width' => $structured['width'] !== null,
                'height' => $structured['height'] !== null,
                'volume' => $structured['volume'] !== null,
                'delivery_receipt_number' => $structured['delivery_receipt_number'] !== null,
            ],
            'confidence' => $confidence,
        ], $parserMeta);
    }

    private function extractStructuredFields(string $text): array
    {
        return $this->extractStructuredFieldsWithDebug($text)['values'];
    }

    private function extractStructuredFieldsWithDebug(string $text): array
    {
        $normalized = $this->normalizeOcrText($text);
        $dimensionCandidates = $this->extractDimensionCandidates($normalized);
        $dimensionPick = $this->pickBestDimensionCandidate($dimensionCandidates);
        $best = $dimensionPick['candidate'];
        $bestScore = $dimensionPick['score'];
        $matchSource = $dimensionPick['source'];

        $length = $best['length'];
        $width = $best['width'];
        $height = $best['height'];
        $volume = $best['volume'];

        if ($volume === null && $length !== null && $width !== null && $height !== null) {
            $volume = round($length * $width * $height, 4);
        }

        $drCandidates = $this->extractReceiptCandidates($normalized, $best);
        $drParsed = $this->pickBestReceiptCandidate($drCandidates);
        $reviewSuggestions = $this->buildReviewSuggestions($normalized, $dimensionCandidates, $drCandidates);

        return [
            'values' => [
                'length' => $length,
                'width' => $width,
                'height' => $height,
                'volume' => $volume,
                'delivery_receipt_number' => $drParsed['value'],
            ],
            'matches' => [
                'length_match' => $matchSource,
                'width_match' => $matchSource,
                'height_match' => $matchSource,
                'volume_match' => $matchSource,
                'dr_match' => $drParsed['match'],
                'parser_source' => $matchSource,
                'parser_score' => $bestScore >= 0 ? round($bestScore, 4) : null,
            ],
            'meta' => [
                'parser_version' => 'adaptive-v1',
                'parser_candidates' => $this->summarizeParserCandidates($dimensionCandidates),
                'review_suggestions' => $reviewSuggestions,
                'confidence_breakdown' => [
                    'dimension' => $bestScore >= 0 ? round($bestScore, 4) : null,
                    'delivery_receipt_number' => $drParsed['confidence'],
                ],
            ],
        ];
    }

    /**
     * @return list<array{
     *   source:string,
     *   stage:string,
     *   score:float,
     *   confidence:float,
     *   candidate:array{length:?float,width:?float,height:?float,volume:?float}
     * }>
     */
    private function extractDimensionCandidates(string $text): array
    {
        $base = [
            ['source' => 'structured_column', 'stage' => 'structured', 'candidate' => $this->extractColumnLabeledDimensions($text)],
            ['source' => 'structured_tabular', 'stage' => 'structured', 'candidate' => $this->extractTabularDimensions($text)],
            ['source' => 'keyword_labeled', 'stage' => 'keyword', 'candidate' => $this->extractLabeledDimensions($text)],
            ['source' => 'regex_inline', 'stage' => 'regex', 'candidate' => array_merge($this->extractInlineDimensions($text), ['volume' => null])],
            ['source' => 'context_window', 'stage' => 'context', 'candidate' => $this->extractContextDimensions($text)],
        ];

        $candidates = [];
        foreach ($base as $entry) {
            $candidate = $this->normalizeDimensionUnits($entry['candidate']);
            $score = $this->scoreDimensionCandidate($candidate);
            if ($score < 0) {
                continue;
            }

            $stageBonus = match ($entry['stage']) {
                'structured' => 0.75,
                'keyword' => 0.45,
                'regex' => 0.35,
                'context' => 0.25,
                default => 0.0,
            };
            $finalScore = $score + $stageBonus;
            $confidence = max(0.05, min(0.99, $finalScore / 8.0));

            $candidates[] = [
                'source' => $entry['source'],
                'stage' => $entry['stage'],
                'score' => $finalScore,
                'confidence' => $confidence,
                'candidate' => $candidate,
            ];
        }

        return $candidates;
    }

    /**
     * @param  list<array{source:string,stage:string,score:float,confidence:float,candidate:array{length:?float,width:?float,height:?float,volume:?float}}>  $candidates
     * @return array{candidate:array{length:?float,width:?float,height:?float,volume:?float},score:float,source:string}
     */
    private function pickBestDimensionCandidate(array $candidates): array
    {
        if ($candidates === []) {
            return [
                'candidate' => ['length' => null, 'width' => null, 'height' => null, 'volume' => null],
                'score' => -1.0,
                'source' => 'none',
            ];
        }

        usort($candidates, static fn ($a, $b) => $b['score'] <=> $a['score']);
        $best = $candidates[0];

        return [
            'candidate' => $best['candidate'],
            'score' => $best['score'],
            'source' => $best['source'],
        ];
    }

    /**
     * @param  list<array{source:string,stage:string,score:float,confidence:float,candidate:array{length:?float,width:?float,height:?float,volume:?float}}>  $candidates
     * @return list<array{source:string,stage:string,score:float,confidence:float,values:array{length:?float,width:?float,height:?float,volume:?float}}>
     */
    private function summarizeParserCandidates(array $candidates): array
    {
        usort($candidates, static fn ($a, $b) => $b['score'] <=> $a['score']);
        $top = array_slice($candidates, 0, 5);

        return array_map(static fn ($entry) => [
            'source' => $entry['source'],
            'stage' => $entry['stage'],
            'score' => round($entry['score'], 4),
            'confidence' => round($entry['confidence'], 4),
            'values' => $entry['candidate'],
        ], $top);
    }

    /**
     * @param  list<array{source:string,stage:string,score:float,confidence:float,candidate:array{length:?float,width:?float,height:?float,volume:?float}}>  $dimensionCandidates
     * @param  list<array{value:string,match:string,source:string,confidence:float}>  $drCandidates
     */
    private function buildReviewSuggestions(string $text, array $dimensionCandidates, array $drCandidates): array
    {
        $suggestions = [
            'length' => [],
            'width' => [],
            'height' => [],
            'volume' => [],
            'delivery_receipt_number' => [],
            'supplier' => [],
            'customer' => [],
            'date' => [],
            'quantity' => [],
            'total' => [],
            'reference_no' => [],
            'invoice_no' => [],
            'job_order' => [],
            'delivery_no' => [],
        ];

        foreach ($dimensionCandidates as $candidate) {
            foreach (['length', 'width', 'height', 'volume'] as $field) {
                $value = $candidate['candidate'][$field] ?? null;
                if ($value === null) {
                    continue;
                }

                $suggestions[$field][] = [
                    'value' => $value,
                    'source' => $candidate['source'],
                    'confidence' => round($candidate['confidence'], 4),
                ];
            }
        }

        foreach ($drCandidates as $entry) {
            $suggestions['delivery_receipt_number'][] = [
                'value' => $entry['value'],
                'source' => $entry['source'],
                'confidence' => round($entry['confidence'], 4),
            ];
        }

        $this->appendLabelSuggestion($suggestions['supplier'], $text, ['supplier', 'vendor', 'company'], 'supplier');
        $this->appendLabelSuggestion($suggestions['customer'], $text, ['customer', 'client', 'sold to'], 'customer');
        $this->appendLabelSuggestion($suggestions['date'], $text, ['delivery date', 'invoice date', 'receipt date', 'date'], 'date');
        $this->appendLabelSuggestion($suggestions['quantity'], $text, ['qty', 'quantity'], 'quantity');
        $this->appendLabelSuggestion($suggestions['total'], $text, ['grand total', 'net total', 'total', 'amount'], 'total');
        $this->appendLabelSuggestion($suggestions['reference_no'], $text, ['reference no', 'ref no'], 'reference_no');
        $this->appendLabelSuggestion($suggestions['invoice_no'], $text, ['invoice no'], 'invoice_no');
        $this->appendLabelSuggestion($suggestions['job_order'], $text, ['job order', 'jo'], 'job_order');
        $this->appendLabelSuggestion($suggestions['delivery_no'], $text, ['delivery no'], 'delivery_no');

        foreach ($suggestions as $field => $entries) {
            $unique = [];
            foreach ($entries as $entry) {
                $key = strtolower((string) ($entry['value'] ?? ''));
                if ($key === '' || isset($unique[$key])) {
                    continue;
                }
                $unique[$key] = $entry;
            }

            $sorted = array_values($unique);
            usort($sorted, static fn ($a, $b) => ($b['confidence'] ?? 0) <=> ($a['confidence'] ?? 0));
            $suggestions[$field] = array_slice($sorted, 0, 3);
        }

        return $suggestions;
    }

    /**
     * @param  list<array{value:mixed,source:string,confidence:float}>  $bucket
     * @param  list<string>  $labels
     */
    private function appendLabelSuggestion(array &$bucket, string $text, array $labels, string $source): void
    {
        foreach ($labels as $label) {
            $pattern = '/(?:^|\n)\s*'.preg_quote($label, '/').'\s*[:#.-]?\s*([^\n]{2,80})/i';
            if (! preg_match($pattern, $text, $m)) {
                continue;
            }

            $value = trim((string) ($m[1] ?? ''));
            if ($value === '') {
                continue;
            }

            $bucket[] = [
                'value' => $value,
                'source' => $source,
                'confidence' => 0.55,
            ];
        }
    }

    /**
     * @return array{length:?float,width:?float,height:?float,volume:?float}
     */
    private function extractContextDimensions(string $text): array
    {
        $length = $this->extractContextMeasurement($text, ['length', 'len', 'dimension length', 'l']);
        $width = $this->extractContextMeasurement($text, ['width', 'wid', 'w']);
        $height = $this->extractContextMeasurement($text, ['height', 'hgt', 'h']);
        $volume = $this->extractContextMeasurement($text, ['volume', 'cbm', 'cubic meter', 'm3', 'm³', 'v']);

        return [
            'length' => $length,
            'width' => $width,
            'height' => $height,
            'volume' => $volume,
        ];
    }

    /**
     * @param  list<string>  $labels
     */
    private function extractContextMeasurement(string $text, array $labels): ?float
    {
        foreach ($labels as $label) {
            $pattern = '/\b'.preg_quote($label, '/').'\b[^\n\r]{0,36}?([0-9]+(?:[.,][0-9]+)?)/i';
            if (preg_match($pattern, $text, $m)) {
                return $this->toFloat($m[1] ?? null);
            }
        }

        return null;
    }

    /**
     * @return array{length:?float,width:?float,height:?float,volume:?float}
     */
    private function extractLabeledDimensions(string $text): array
    {
        $lengthParsed = $this->extractMeasurement($text, [
            'length', 'len', 'lngth', 'lengt', '1ength', 'iength', 'dimension length',
        ]);
        $widthParsed = $this->extractMeasurement($text, [
            'width', 'wid', 'wdth', 'w1dth', 'dimension width',
        ]);
        $heightParsed = $this->extractMeasurement($text, [
            'height', 'hgt', 'he1ght', 'hieght', 'dimension height',
        ]);
        $volumeParsed = $this->extractMeasurement($text, [
            'volume', 'vol', 'cbm', 'cu m', 'cubic', 'cubic meter', 'm3', 'm³',
        ]);

        return [
            'length' => $lengthParsed['value'],
            'width' => $widthParsed['value'],
            'height' => $heightParsed['value'],
            'volume' => $volumeParsed['value'],
        ];
    }

    /**
     * @return array{length:?float,width:?float,height:?float,volume:?float}
     */
    private function extractColumnLabeledDimensions(string $text): array
    {
        $length = $this->extractUnitColumnValue($text, ['l', 'length'], ['cm', 'm']);
        $width = $this->extractUnitColumnValue($text, ['w', 'width'], ['cm', 'm']);
        $height = $this->extractUnitColumnValue($text, ['h', 'height'], ['cm', 'm']);
        $volume = $this->extractUnitColumnValue($text, ['v', 'volume', 'vol'], ['m3', 'm³', 'cbm']);

        return [
            'length' => $length,
            'width' => $width,
            'height' => $height,
            'volume' => $volume,
        ];
    }

    /**
     * @param  list<string>  $labels
     * @param  list<string>  $units
     */
    private function extractUnitColumnValue(string $text, array $labels, array $units): ?float
    {
        foreach ($labels as $label) {
            foreach ($units as $unit) {
                $unitPattern = preg_quote($unit, '/');
                $pattern = '/\b'.preg_quote($label, '/').'\s*\(\s*'.$unitPattern.'\s*\)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)/i';
                if (preg_match($pattern, $text, $m)) {
                    return $this->toFloat($m[1] ?? null);
                }
            }

            $pattern = '/\b'.preg_quote($label, '/').'\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:cm|mm|m|meter|meters|cbm|m3|m³)\b/i';
            if (preg_match($pattern, $text, $m)) {
                return $this->toFloat($m[1] ?? null);
            }

            $pattern = '/\b'.preg_quote($label, '/').'\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)\b/i';
            if (preg_match($pattern, $text, $m)) {
                return $this->toFloat($m[1] ?? null);
            }
        }

        return null;
    }

    /**
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $candidate
     */
    private function scoreDimensionCandidate(array $candidate): float
    {
        $length = $candidate['length'];
        $width = $candidate['width'];
        $height = $candidate['height'];
        $volume = $candidate['volume'];

        if ($length === null || $width === null || $height === null) {
            return -1.0;
        }

        if ($length <= 0 || $width <= 0 || $height <= 0) {
            return -1.0;
        }

        [$lengthM, $widthM, $heightM] = $this->toMetersTriple($length, $width, $height);
        if ($lengthM === null || $widthM === null || $heightM === null) {
            return -1.0;
        }

        if (! $this->arePlausibleMeters($lengthM, $widthM, $heightM)) {
            return -1.0;
        }

        $score = 1.0;
        $filled = collect([$length, $width, $height, $volume])->filter(static fn ($v) => $v !== null)->count();
        $score += $filled * 0.5;

        if ($volume !== null && $volume > 0) {
            $calc = $lengthM * $widthM * $heightM;
            $delta = abs($calc - $volume) / max($volume, 0.0001);
            if ($delta > 0.2) {
                return -1.0;
            }
            $score += max(0.0, 3.0 - ($delta * 10.0));
        } else {
            $score += 0.5;
        }

        if ($widthM < 1.0 || $heightM < 1.0) {
            $score -= 1.5;
        }

        return $score;
    }

    /**
     * @return array{0:?float,1:?float,2:?float}
     */
    private function toMetersTriple(float $length, float $width, float $height): array
    {
        $max = max($length, $width, $height);
        if ($max > 50) {
            return [$length / 100, $width / 100, $height / 100];
        }

        return [$length, $width, $height];
    }

    private function arePlausibleMeters(float $lengthM, float $widthM, float $heightM): bool
    {
        foreach ([$lengthM, $widthM, $heightM] as $value) {
            if ($value < 0.4 || $value > 30.0) {
                return false;
            }
        }

        if ($widthM > $lengthM + 5.0) {
            return false;
        }

        return true;
    }

    /**
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $dims
     * @return array{length:?float,width:?float,height:?float,volume:?float}
     */
    private function normalizeDimensionUnits(array $dims): array
    {
        $length = $dims['length'];
        $width = $dims['width'];
        $height = $dims['height'];
        if ($length === null || $width === null || $height === null) {
            return $dims;
        }

        $max = max($length, $width, $height);
        if ($max <= 50) {
            return $dims;
        }

        return [
            'length' => round($length / 100, 4),
            'width' => round($width / 100, 4),
            'height' => round($height / 100, 4),
            'volume' => $dims['volume'],
        ];
    }

    private function extractMeasurement(string $text, array $labels): array
    {
        $match = null;
        foreach ($labels as $label) {
            $pattern = '/(?:\b'.preg_quote($label, '/').'\b)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)(?:\s*(?:cm|mm|m|meter|meters|cbm|m3|m³))?/i';
            if (preg_match($pattern, $text, $m)) {
                $match = trim((string) ($m[0] ?? ''));

                return ['value' => $this->toFloat($m[1] ?? null), 'match' => $match];
            }
        }

        return ['value' => null, 'match' => null];
    }

    /**
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $dimensions
     * @return array{value:?string,match:?string}
     */
    private function extractReceiptNumber(string $text, array $dimensions = []): array
    {
        return $this->pickBestReceiptCandidate(
            $this->extractReceiptCandidates($text, $dimensions)
        );
    }

    /**
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $dimensions
     * @return list<array{value:string,match:string,source:string,confidence:float}>
     */
    private function extractReceiptCandidates(string $text, array $dimensions = []): array
    {
        $patterns = [
            ['regex' => '/\bdr\s*(?:no|number|#)?\s*[:.\-]?\s*(?:dr\s*[-:\s]?)?(\d{5,10})\b/i', 'source' => 'dr_label', 'confidence' => 0.95],
            ['regex' => '/\b(dr[-\s]?\d{5,10})\b/i', 'source' => 'dr_token', 'confidence' => 0.9],
            ['regex' => '/(?:delivery\s*receipt|receipt|invoice|reference|ref|delivery)\s*(?:no|number|#)?\s*[:#.\-]?\s*(dr[-\/]?[0-9]{5,10}|[a-z]{1,4}[-\/]?[0-9]{4,})/i', 'source' => 'reference_label', 'confidence' => 0.8],
            ['regex' => '/(?:delivery\s*receipt[\s\S]{0,120})\bno\.?\s*[:#.\-]?\s*(\d{5,10})\b/i', 'source' => 'header_no', 'confidence' => 0.78],
            ['regex' => '/\bn[o0]\s*[:#.\-]\s*(\d{5,10})\b/i', 'source' => 'no_label', 'confidence' => 0.7],
            ['regex' => '/\b(?:invoice|reference|ref|delivery)\s*(?:no|number|#)\s*[:#.\-]?\s*([a-z0-9\-\/]{4,20})\b/i', 'source' => 'generic_ref', 'confidence' => 0.66],
        ];

        $candidates = [];
        foreach ($patterns as $entry) {
            if (! preg_match_all($entry['regex'], $text, $matches, PREG_SET_ORDER)) {
                continue;
            }

            foreach ($matches as $m) {
                $rawMatch = trim((string) ($m[0] ?? ''));
                $value = $this->normalizeReceiptNumber((string) ($m[1] ?? ''), $rawMatch);
                if ($value === '' || $value === 'DR' || $value === 'DR-') {
                    continue;
                }

                $candidates[] = [
                    'value' => $value,
                    'match' => $rawMatch,
                    'source' => $entry['source'],
                    'confidence' => $entry['confidence'],
                ];
            }
        }

        if ($this->hasDimensionContext($dimensions)) {
            $fallback = $this->extractReceiptSerialFallback($text, $dimensions);
            if ($fallback !== null) {
                $candidates[] = [
                    'value' => $fallback['value'],
                    'match' => $fallback['match'],
                    'source' => 'serial_fallback',
                    'confidence' => 0.6,
                ];
            }
        }

        return $candidates;
    }

    /**
     * @param  list<array{value:string,match:string,source:string,confidence:float}>  $candidates
     * @return array{value:?string,match:?string,confidence:?float}
     */
    private function pickBestReceiptCandidate(array $candidates): array
    {
        if ($candidates === []) {
            return ['value' => null, 'match' => null, 'confidence' => null];
        }

        usort($candidates, static fn ($a, $b) => $b['confidence'] <=> $a['confidence']);
        $best = $candidates[0];

        return [
            'value' => $best['value'],
            'match' => $best['match'],
            'confidence' => $best['confidence'],
        ];
    }

    /**
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $dimensions
     */
    private function hasDimensionContext(array $dimensions): bool
    {
        return ($dimensions['length'] ?? null) !== null
            && ($dimensions['width'] ?? null) !== null
            && ($dimensions['height'] ?? null) !== null;
    }

    /**
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $dimensions
     * @return array{value:string,match:string}|null
     */
    private function extractReceiptSerialFallback(string $text, array $dimensions): ?array
    {
        $exclude = [];
        foreach (['length', 'width', 'height', 'volume'] as $key) {
            $value = $dimensions[$key] ?? null;
            if ($value === null) {
                continue;
            }
            $exclude[] = (string) (int) round($value);
            $exclude[] = (string) (int) round($value * 100);
            $exclude[] = str_replace('.', '', number_format($value, 2, '.', ''));
        }

        if (! preg_match_all('/\b(\d{6,8})\b/', $text, $matches)) {
            return null;
        }

        foreach (array_reverse($matches[1]) as $candidate) {
            if (in_array($candidate, $exclude, true)) {
                continue;
            }

            return [
                'value' => 'DR-'.$candidate,
                'match' => 'serial:'.$candidate,
            ];
        }

        return null;
    }

    private function normalizeReceiptNumber(string $value, string $fullMatch): string
    {
        $value = strtoupper(trim($value));
        $value = preg_replace('/\s+/', '', $value) ?? $value;
        if ($value === '') {
            return '';
        }

        if (preg_match('/^DR[-]?(\d+)$/i', $value)) {
            return preg_replace('/^DR[-]?(\d+)$/i', 'DR-$1', $value) ?? $value;
        }

        if (
            preg_match('/^\d{5,8}$/', $value)
            && preg_match('/\b(dr|delivery\s*receipt|receipt|\bno\b|\bserial:)/i', $fullMatch)
        ) {
            return 'DR-'.$value;
        }

        return $value;
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
        if (count($values) < 4) {
            return ['length' => null, 'width' => null, 'height' => null, 'volume' => null];
        }

        $best = ['length' => null, 'width' => null, 'height' => null, 'volume' => null];
        $bestScore = -1.0;

        for ($i = 0; $i <= count($values) - 4; $i++) {
            $candidate = [
                'length' => $values[$i],
                'width' => $values[$i + 1],
                'height' => $values[$i + 2],
                'volume' => $values[$i + 3],
            ];
            $score = $this->scoreDimensionCandidate($candidate);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $candidate;
            }
        }

        if ($bestScore < 0) {
            return ['length' => null, 'width' => null, 'height' => null, 'volume' => null];
        }

        return $best;
    }

    private function normalizeOcrText(string $text): string
    {
        $normalized = strtolower($text);
        $normalized = str_replace(["\r\n", "\r"], "\n", $normalized);
        $normalized = str_replace(['|', '¦', '—', '_', '×'], ['1', '1', '-', '-', 'x'], $normalized);

        // Common OCR substitutions for labels.
        $normalized = preg_replace('/\b1ength\b/u', 'length', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bw1dth\b/u', 'width', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bhe1ght\b/u', 'height', $normalized) ?? $normalized;
        $normalized = preg_replace('/\blen\b/u', 'length', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bqty\b/u', 'quantity', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bcbm\b/u', 'volume', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bcubic\s*meter(?:s)?\b/u', 'volume', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bm3\b/u', 'volume', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bm³\b/u', 'volume', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bl\s*:\s*/u', 'length: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bw\s*:\s*/u', 'width: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bh\s*:\s*/u', 'height: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bv\s*:\s*/u', 'volume: ', $normalized) ?? $normalized;
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

    private function newDebugContext(DeliveryDocument $document, string $diskPath): array
    {
        return [
            'document_id' => $document->id,
            'filename' => basename($diskPath),
            'disk_path' => $diskPath,
            'preprocessed_path' => null,
            'tesseract_command' => null,
        ];
    }

    private function writeDebugReport(
        OcrResult $result,
        array $debugContext,
        string $rawText,
        ?float $confidence,
        array $regexMatches,
        array $dataset,
        ?string $errorMessage = null
    ): void {
        if (! config('ocr.debug_mode', true)) {
            return;
        }

        $statusReport = [
            'ocr_executed' => $result->processing_status !== self::STATUS_PENDING,
            'text_extracted' => trim($rawText) !== '',
            'parser_executed' => true,
            'dataset_mapping_ok' => collect($dataset)->filter(static fn ($v) => $v !== null && $v !== '')->isNotEmpty(),
        ];

        $content = implode(PHP_EOL, [
            '====================',
            'OCR DEBUG REPORT',
            '====================',
            'timestamp: '.now()->toDateTimeString(),
            'document_id: '.($debugContext['document_id'] ?? $result->document_id),
            '1. Uploaded file: '.($debugContext['filename'] ?? 'unknown'),
            '2. Preprocessed image path: '.($debugContext['preprocessed_path'] ?: 'n/a'),
            '3. Tesseract command executed: '.($debugContext['tesseract_command'] ?: 'n/a'),
            '4. Raw OCR output:',
            trim($rawText) !== '' ? $rawText : '[empty]',
            '5. OCR confidence: '.($confidence !== null ? number_format($confidence * 100, 2).'%' : 'n/a'),
            '6. Parsed values:',
            '   Length: '.($dataset['length'] ?? '—'),
            '   Width: '.($dataset['width'] ?? '—'),
            '   Height: '.($dataset['height'] ?? '—'),
            '   Volume: '.($dataset['volume'] ?? '—'),
            '   DR Number: '.($dataset['delivery_receipt_number'] ?? '—'),
            '7. Regex matches:',
            '   length_match: '.($regexMatches['length_match'] ?? '—'),
            '   width_match: '.($regexMatches['width_match'] ?? '—'),
            '   height_match: '.($regexMatches['height_match'] ?? '—'),
            '   volume_match: '.($regexMatches['volume_match'] ?? '—'),
            '   dr_match: '.($regexMatches['dr_match'] ?? '—'),
            '8. Final dataset:',
            json_encode([
                'length' => $dataset['length'] ?? null,
                'width' => $dataset['width'] ?? null,
                'height' => $dataset['height'] ?? null,
                'volume' => $dataset['volume'] ?? null,
                'dr_no' => $dataset['delivery_receipt_number'] ?? null,
            ], JSON_UNESCAPED_SLASHES),
            'OCR STATUS:',
            ($statusReport['ocr_executed'] ? '✓' : '✗').' OCR executed',
            ($statusReport['text_extracted'] ? '✓' : '✗').' Text extracted',
            ($statusReport['parser_executed'] ? '✓' : '✗').' Parser executed',
            ($statusReport['dataset_mapping_ok'] ? '✓' : '✗').' Dataset mapping',
            'processing_status: '.$result->processing_status,
            'error_message: '.($errorMessage ?: $result->error_message ?: 'none'),
            '',
        ]);

        @file_put_contents(storage_path('logs/ocr-debug.log'), $content.PHP_EOL, FILE_APPEND);
    }
}
