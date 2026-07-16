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
        private readonly OcrImagePreprocessor $imagePreprocessor,
        private readonly OcrConfidenceScorer $confidenceScorer,
        private readonly TesseractMultipassEngine $tesseractMultipass,
        private readonly OcrValidationEngine $validationEngine,
        private readonly OcrDebugLogger $debugLogger,
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

        $preprocess = $this->imagePreprocessor->preprocess($diskPath, $document->id);
        $ocrPath = $preprocess['path'];
        $preprocessDiagnostics = is_array($preprocess['diagnostics'] ?? null) ? $preprocess['diagnostics'] : [];
        $debugContext['preprocessed_path'] = (string) ($preprocessDiagnostics['preprocessed_path'] ?? $ocrPath);
        $debugContext['preprocess_steps'] = $preprocessDiagnostics['preprocess_steps'] ?? [];
        $debugContext['debug_artifacts'] = $preprocessDiagnostics['debug_artifacts'] ?? [];
        $debugContext = array_merge($debugContext, $this->imageMeta($ocrPath));

        try {
            if (config('ocr.tesseract_multipass', true)) {
                $multipass = $this->tesseractMultipass->run($ocrPath, $tesseract);
                if ($multipass !== null) {
                    $debugContext['tesseract_command'] = $multipass['command'];
                    $debugContext['tesseract_oem'] = $multipass['oem'];
                    $debugContext['tesseract_psm'] = $multipass['psm'];
                    $debugContext['execution_time_ms'] = $multipass['execution_time_ms'];
                    $debugContext['multipass_report'] = $multipass['multipass_report'];

                    return $this->persistExtraction(
                        $result,
                        $document,
                        $multipass['text'],
                        $multipass['confidence'],
                        'tesseract-multipass',
                        ['multipass_report' => $multipass['multipass_report'], 'best_oem' => $multipass['oem'], 'best_psm' => $multipass['psm']],
                        $debugContext,
                        [],
                        ['provider_ocr' => $multipass['confidence']]
                    );
                }
            }

            $cmd = [$tesseract, $ocrPath, 'stdout', '--oem', '3', '-l', 'eng', '--psm', '6'];
            $process = new Process($cmd);
            $process->setTimeout(120);
            $process->run();
            $debugContext['tesseract_command'] = implode(' ', $cmd);
            $debugContext['tesseract_oem'] = 3;
            $debugContext['tesseract_psm'] = 6;

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
                $preprocessDiagnostics,
                $debugContext,
                [],
                []
            );
        } catch (Throwable $e) {
            Log::error('OCR processing exception', ['document_id' => $document->id, 'error' => $e->getMessage()]);

            return $this->fail($result, $e->getMessage(), $debugContext);
        } finally {
            if ($ocrPath !== $diskPath && is_file($ocrPath)) {
                @unlink($ocrPath);
            }
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
        $preprocess = $this->imagePreprocessor->preprocess($diskPath, $document->id);
        $ocrPath = $preprocess['path'];
        $preprocessDiagnostics = is_array($preprocess['diagnostics'] ?? null) ? $preprocess['diagnostics'] : [];

        try {
            $payload = $this->googleDocumentAiService->extractFromImage($ocrPath);
        } catch (Throwable $e) {
            $debugContext['google_document_ai_error'] = $e->getMessage();
            Log::warning('Google Document AI failed, falling back to legacy OCR.', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
            ]);

            if ($ocrPath !== $diskPath && is_file($ocrPath)) {
                @unlink($ocrPath);
            }

            return null;
        } finally {
            if ($ocrPath !== $diskPath && is_file($ocrPath)) {
                @unlink($ocrPath);
            }
        }

        if (! is_array($payload)) {
            $debugContext['google_document_ai_error'] = 'Google Document AI returned a malformed payload.';
            Log::warning('Google Document AI returned malformed payload, falling back to legacy OCR.', [
                'document_id' => $document->id,
            ]);

            return null;
        }

        $text = trim((string) ($payload['text'] ?? ''));
        $providerConfidence = is_numeric($payload['confidence'] ?? null)
            ? (float) $payload['confidence']
            : null;
        $engine = trim((string) ($payload['engine'] ?? 'google-document-ai')) ?: 'google-document-ai';
        $diagnostics = is_array($payload['diagnostics'] ?? null) ? $payload['diagnostics'] : [];
        $structuredHints = is_array($payload['structured_hints'] ?? null) ? $payload['structured_hints'] : [];
        $providerSignals = is_array($payload['provider_signals'] ?? null) ? $payload['provider_signals'] : [];
        if ($providerConfidence !== null) {
            $providerSignals['entity_confidence_avg'] = $providerConfidence;
            $providerSignals['provider_ocr'] = $providerConfidence;
        }

        $diagnostics = array_merge($diagnostics, $preprocessDiagnostics);

        $debugContext['tesseract_command'] = (string) ($payload['command'] ?? 'google.documentai.processDocument');
        $debugContext['preprocessed_path'] = (string) ($preprocessDiagnostics['preprocessed_path'] ?? '');

        return $this->persistExtraction(
            $result,
            $document,
            $text,
            null,
            $engine,
            $diagnostics,
            $debugContext,
            $structuredHints,
            $providerSignals
        );
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
                    'X-OCR-OEM-Candidates' => implode(',', (array) config('ocr.tesseract_oem_candidates', ['3'])),
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
        $providerConfidence = is_numeric($payload['confidence'] ?? null)
            ? (float) $payload['confidence']
            : null;
        $engine = trim((string) ($payload['engine'] ?? 'render-tesseract')) ?: 'render-tesseract';
        $diagnostics = $this->mergeGoogleFallbackDiagnostics(
            is_array($payload['diagnostics'] ?? null) ? $payload['diagnostics'] : [],
            $debugContext
        );
        $providerSignals = [
            'provider_ocr' => $providerConfidence,
            'entity_confidence_avg' => $providerConfidence,
        ];
        if (is_numeric($diagnostics['avg_conf'] ?? null)) {
            $tsvConf = ((float) $diagnostics['avg_conf']) / 100.0;
            $providerSignals['provider_ocr'] = $tsvConf;
            $providerSignals['entity_confidence_avg'] = $tsvConf;
        }

        $debugContext['tesseract_command'] = (string) ($payload['command'] ?? 'remote:multipass');
        $debugContext['preprocessed_path'] = (string) ($payload['preprocessed_image_path'] ?? '');

        return $this->persistExtraction(
            $result,
            $document,
            $text,
            null,
            $engine,
            $diagnostics,
            $debugContext,
            [],
            $providerSignals
        );
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
        array $structuredHints = [],
        array $providerSignals = [],
    ): OcrResult {
        $displayText = $text !== '' ? $text : '(No text detected — image may be blank or low contrast.)';
        $parsed = $this->extractStructuredFieldsWithDebug($text, $structuredHints);
        $structured = $parsed['values'];

        $scoreResult = $this->confidenceScorer->compute($text, $providerSignals, $parsed);
        $confidence = $confidence ?? $scoreResult['final'];
        $confidenceModel = $scoreResult['confidence_model'];

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

        $parserMeta = $parsed['meta'] ?? [];
        $parserMeta['confidence_model'] = $confidenceModel;

        $validation = $this->validationEngine->validate($result, array_merge($structured, $parsed['auxiliary'] ?? []));

        $diagnostics = $this->buildDiagnostics(
            $diagnostics,
            $text,
            $confidence,
            $structured,
            $parsed['matches'],
            array_merge($parserMeta, [
                'validation' => $validation,
                'field_confidence' => $parsed['field_confidence'] ?? [],
                'auxiliary_fields' => $parsed['auxiliary'] ?? [],
            ])
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

        $fresh = $result->fresh();
        $this->writeDebugReport($fresh, $debugContext, $text, $confidence, $parsed, $structured, $validation);

        return $fresh;
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
        ], null, $message);

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

    private function extractStructuredFields(string $text, array $hints = []): array
    {
        return $this->extractStructuredFieldsWithDebug($text, $hints)['values'];
    }

    /**
     * @param  array<string, mixed>  $hints
     */
    private function extractStructuredFieldsWithDebug(string $text, array $hints = []): array
    {
        $normalized = $this->normalizeOcrText($this->mergeParserInput($text, $hints));
        $neighborText = $this->extractNeighborLabelValues($normalized);
        if ($neighborText !== '') {
            $normalized = $this->normalizeOcrText($normalized."\n".$neighborText);
        }

        $dimensionCandidates = $this->extractDimensionCandidates($normalized);
        $dimensionCandidates = $this->injectEntityDimensionHints($dimensionCandidates, $hints);
        $dimensionPick = $this->pickBestDimensionCandidate($dimensionCandidates);
        $best = $this->fillMissingDimensionsFromCandidates($dimensionPick['candidate'], $dimensionCandidates);
        $bestScore = $dimensionPick['score'];
        $matchSource = $dimensionPick['source'];

        $length = $best['length'];
        $width = $best['width'];
        $height = $best['height'];
        $volume = $best['volume'];

        if ($volume === null && $length !== null && $width !== null && $height !== null) {
            $volume = round(($length * $width * $height) / 1_000_000, 4);
        }

        $drCandidates = $this->extractReceiptCandidates($normalized, $best);
        $drCandidates = $this->injectEntityReceiptHints($drCandidates, $hints);
        $drParsed = $this->pickBestReceiptCandidate($drCandidates);
        $reviewSuggestions = $this->buildReviewSuggestions($normalized, $dimensionCandidates, $drCandidates);
        $this->injectNeighborSuggestions($reviewSuggestions, $hints);
        $auxiliary = $this->extractAuxiliaryFields($normalized);
        $fieldConfidence = $this->buildFieldConfidence($best, $drParsed, $dimensionCandidates, $bestScore);

        return [
            'values' => [
                'length' => $length,
                'width' => $width,
                'height' => $height,
                'volume' => $volume,
                'delivery_receipt_number' => $drParsed['value'],
            ],
            'auxiliary' => $auxiliary,
            'field_confidence' => $fieldConfidence,
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
                'parser_version' => 'adaptive-v2',
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

        $this->appendLabelSuggestion($suggestions['supplier'], $text, ['supplier', 'vendor', 'company', 'quarry', 'plant', 'batching', 'aggregates', 'concrete'], 'supplier');
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
            'length', 'len', 'lngth', 'lengt', '1ength', 'iength', 'dimension length', 'dim', 'size', 'measurement',
        ]);
        $widthParsed = $this->extractMeasurement($text, [
            'width', 'wid', 'wdth', 'w1dth', 'dimension width', 'dim', 'size', 'measurement',
        ]);
        $heightParsed = $this->extractMeasurement($text, [
            'height', 'hgt', 'he1ght', 'hieght', 'dimension height', 'dim', 'size', 'measurement',
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
     * Normalize dimensions to centimeters for storage (matches receipt handwriting and master data).
     *
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
        if ($max > 50) {
            return $dims;
        }

        return [
            'length' => round($length * 100, 4),
            'width' => round($width * 100, 4),
            'height' => round($height * 100, 4),
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
            ['regex' => '/\bdr#\s*(\d{5,10})\b/i', 'source' => 'dr_hash', 'confidence' => 0.92],
            ['regex' => '/\bticket\s*no\.?\s*[:#.\-]?\s*(\d{5,10})\b/i', 'source' => 'ticket_no', 'confidence' => 0.88],
            ['regex' => '/\bsi\s*no\.?\s*[:#.\-]?\s*(\d{5,10})\b/i', 'source' => 'si_no', 'confidence' => 0.86],
            ['regex' => '/\bweighbridge\s*[:#.\-]?\s*(\d{5,10})\b/i', 'source' => 'weighbridge', 'confidence' => 0.84],
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
        $normalized = preg_replace('/\bl\s*=\s*/u', 'length: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bw\s*:\s*/u', 'width: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bw\s*=\s*/u', 'width: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bh\s*:\s*/u', 'height: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bh\s*=\s*/u', 'height: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bv\s*:\s*/u', 'volume: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\bv\s*=\s*/u', 'volume: ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\brn\b/u', 'm', $normalized) ?? $normalized;

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $hints
     */
    private function mergeParserInput(string $text, array $hints): string
    {
        $parts = [trim($text)];
        foreach ((array) ($hints['table_lines'] ?? []) as $line) {
            $line = trim((string) $line);
            if ($line !== '') {
                $parts[] = $line;
            }
        }
        foreach ((array) ($hints['entity_mentions'] ?? []) as $mention) {
            $mention = trim((string) $mention);
            if ($mention !== '') {
                $parts[] = $mention;
            }
        }
        foreach ((array) ($hints['neighbor_pairs'] ?? []) as $pair) {
            if (! is_array($pair)) {
                continue;
            }
            $label = trim((string) ($pair['label'] ?? ''));
            $value = trim((string) ($pair['value'] ?? ''));
            if ($label !== '' && $value !== '') {
                $parts[] = $label.': '.$value;
            }
        }

        return implode("\n", array_values(array_unique(array_filter($parts, static fn ($p) => $p !== ''))));
    }

  private function extractNeighborLabelValues(string $text): string
  {
    $lines = preg_split('/\R/', $text) ?: [];
    $pairs = [];
    $labelPattern = '/^(supplier|vendor|customer|date|total|amount|invoice|receipt|dr|delivery\s*receipt|length|width|height|volume|dim|size|measurement|ticket\s*no|si\s*no|weighbridge)\b/i';

    for ($i = 0; $i < count($lines) - 1; $i++) {
      $current = trim($lines[$i]);
      $next = trim($lines[$i + 1]);
      if ($current === '' || $next === '') {
        continue;
      }
      if (preg_match($labelPattern, $current) && ! preg_match('/^\d/', $next)) {
        $pairs[] = $current.': '.$next;
      } elseif (preg_match($labelPattern, $current) && preg_match('/^[\d$]/', $next)) {
        $pairs[] = $current.': '.$next;
      }
    }

    return implode("\n", array_unique($pairs));
  }

  /**
   * @param  list<array{source:string,stage:string,score:float,confidence:float,candidate:array{length:?float,width:?float,height:?float,volume:?float}}>  $candidates
   * @param  array<string, mixed>  $hints
   * @return list<array{source:string,stage:string,score:float,confidence:float,candidate:array{length:?float,width:?float,height:?float,volume:?float}}>
   */
  private function injectEntityDimensionHints(array $candidates, array $hints): array
  {
    foreach ((array) ($hints['entities'] ?? []) as $entity) {
      if (! is_array($entity)) {
        continue;
      }
      $conf = is_numeric($entity['confidence'] ?? null) ? (float) $entity['confidence'] : 0.75;
      if ($conf < 0.6) {
        continue;
      }

      $type = (string) ($entity['type'] ?? '');
      $value = $entity['normalized_value'] ?? $entity['mention_text'] ?? null;
      $float = $this->toFloat($value);
      if ($float === null) {
        continue;
      }

      $candidate = ['length' => null, 'width' => null, 'height' => null, 'volume' => null];
      if (str_contains($type, 'length') || str_contains($type, 'dimension')) {
        $candidate['length'] = $float;
      } elseif (str_contains($type, 'width')) {
        $candidate['width'] = $float;
      } elseif (str_contains($type, 'height')) {
        $candidate['height'] = $float;
      } elseif (str_contains($type, 'volume') || str_contains($type, 'total_amount')) {
        $candidate['volume'] = $float;
      } else {
        continue;
      }

      $score = $this->scoreDimensionCandidate($candidate);
      if ($score < 0) {
        continue;
      }

      $candidates[] = [
        'source' => 'document_ai_entity',
        'stage' => 'structured',
        'score' => $score + 0.85,
        'confidence' => min(0.99, $conf),
        'candidate' => $this->normalizeDimensionUnits($candidate),
      ];
    }

    return $candidates;
  }

  /**
   * @param  list<array{value:string,match:string,source:string,confidence:float}>  $candidates
   * @param  array<string, mixed>  $hints
   * @return list<array{value:string,match:string,source:string,confidence:float}>
   */
  private function injectEntityReceiptHints(array $candidates, array $hints): array
  {
    foreach ((array) ($hints['entities'] ?? []) as $entity) {
      if (! is_array($entity)) {
        continue;
      }
      $type = strtolower((string) ($entity['type'] ?? ''));
      if (! preg_match('/invoice|receipt|reference|delivery|ticket/', $type)) {
        continue;
      }

      $conf = is_numeric($entity['confidence'] ?? null) ? (float) $entity['confidence'] : 0.8;
      if ($conf < 0.6) {
        continue;
      }

      $raw = trim((string) ($entity['normalized_value'] ?? $entity['mention_text'] ?? ''));
      $value = $this->normalizeReceiptNumber($raw, $raw);
      if ($value === '') {
        continue;
      }

      $candidates[] = [
        'value' => $value,
        'match' => 'entity:'.$type,
        'source' => 'document_ai_entity',
        'confidence' => min(0.99, $conf),
      ];
    }

    return $candidates;
  }

  /**
   * @param  array<string, list<array{value:mixed,source:string,confidence:float}>>  $reviewSuggestions
   * @param  array<string, mixed>  $hints
   */
  private function injectNeighborSuggestions(array &$reviewSuggestions, array $hints): void
  {
    foreach ((array) ($hints['neighbor_pairs'] ?? []) as $pair) {
      if (! is_array($pair)) {
        continue;
      }
      $label = strtolower(trim((string) ($pair['label'] ?? '')));
      $value = trim((string) ($pair['value'] ?? ''));
      if ($value === '') {
        continue;
      }

      $field = match (true) {
        str_contains($label, 'supplier'), str_contains($label, 'vendor') => 'supplier',
        str_contains($label, 'date') => 'date',
        str_contains($label, 'total'), str_contains($label, 'amount') => 'total',
        default => null,
      };

      if ($field === null || ! isset($reviewSuggestions[$field])) {
        continue;
      }

      $reviewSuggestions[$field][] = [
        'value' => $value,
        'source' => 'neighbor_label',
        'confidence' => 0.72,
      ];
    }
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

    /**
     * Fill missing L/W/H/V from other parser candidates (per-field best pick).
     *
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $best
     * @param  list<array{source:string,stage:string,score:float,confidence:float,candidate:array{length:?float,width:?float,height:?float,volume:?float}}>  $candidates
     * @return array{length:?float,width:?float,height:?float,volume:?float}
     */
    private function fillMissingDimensionsFromCandidates(array $best, array $candidates): array
    {
        foreach (['length', 'width', 'height', 'volume'] as $field) {
            if (($best[$field] ?? null) !== null) {
                continue;
            }

            $fieldBest = null;
            $fieldScore = -1.0;

            foreach ($candidates as $entry) {
                $value = $entry['candidate'][$field] ?? null;
                if ($value === null) {
                    continue;
                }

                $score = $this->scoreIndividualDimensionField($field, (float) $value);
                if ($score > $fieldScore) {
                    $fieldScore = $score;
                    $fieldBest = (float) $value;
                }
            }

            if ($fieldBest !== null) {
                $best[$field] = $fieldBest;
            }
        }

        return $this->normalizeDimensionUnits($best);
    }

    private function scoreIndividualDimensionField(string $field, float $value): float
    {
        if ($value <= 0) {
            return -1.0;
        }

        if ($field === 'volume') {
            return ($value >= 0.01 && $value <= 500) ? 1.5 : -1.0;
        }

        $asMeters = $value > 50 ? $value / 100 : $value;
        if ($asMeters < 0.05 || $asMeters > 35) {
            return -1.0;
        }

        return 1.0 + min(0.5, $asMeters / 10);
    }

    /**
     * @return array<string, ?string>
     */
    private function extractAuxiliaryFields(string $text): array
    {
        return [
            'vehicle_plate' => $this->extractLabeledValue($text, [
                'truck no', 'truck number', 'plate no', 'plate number', 'vehicle plate', 'plate #',
            ]),
            'driver_name' => $this->extractLabeledValue($text, [
                'driver', 'driver name', 'operator', 'delivered by',
            ]),
            'customer' => $this->extractLabeledValue($text, [
                'customer', 'client', 'sold to', 'bill to', 'deliver to',
            ]),
            'company' => $this->extractLabeledValue($text, [
                'company', 'supplier', 'vendor', 'quarry', 'plant',
            ]),
            'destination' => $this->extractLabeledValue($text, [
                'destination', 'delivery address', 'drop off', 'dropoff', 'site',
            ]),
            'material' => $this->extractLabeledValue($text, [
                'material', 'product', 'description', 'item', 'aggregate',
            ]),
            'delivery_date' => $this->extractLabeledValue($text, [
                'delivery date', 'date', 'invoice date', 'receipt date',
            ]),
            'delivery_time' => $this->extractLabeledValue($text, [
                'time', 'delivery time',
            ]),
        ];
    }

    /**
     * @param  list<string>  $labels
     */
    private function extractLabeledValue(string $text, array $labels): ?string
    {
        foreach ($labels as $label) {
            $pattern = '/(?:^|\n)\s*'.preg_quote($label, '/').'\s*[:#.\-]?\s*([^\n]{2,80})/i';
            if (preg_match($pattern, $text, $m)) {
                $value = trim((string) ($m[1] ?? ''));
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    /**
     * @param  array{length:?float,width:?float,height:?float,volume:?float}  $dims
     * @param  array{value:?string,match:?string,confidence:?float}  $drParsed
     * @param  list<array<string,mixed>>  $candidates
     * @return array<string, float|null>
     */
    private function buildFieldConfidence(array $dims, array $drParsed, array $candidates, float $bestScore): array
    {
        $fieldConfidence = [];
        foreach (['length', 'width', 'height', 'volume'] as $field) {
            if (($dims[$field] ?? null) === null) {
                $fieldConfidence[$field] = null;
                continue;
            }

            $conf = $bestScore >= 0 ? min(0.99, max(0.35, $bestScore / 8.0)) : 0.5;
            foreach ($candidates as $entry) {
                if (($entry['candidate'][$field] ?? null) !== null) {
                    $conf = max($conf, (float) ($entry['confidence'] ?? 0.5));
                    break;
                }
            }
            $fieldConfidence[$field] = round($conf, 4);
        }

        $fieldConfidence['delivery_receipt_number'] = $drParsed['confidence'] ?? null;

        return $fieldConfidence;
    }

    /** @return array<string, mixed> */
    private function imageMeta(string $path): array
    {
        $meta = [
            'file_size_bytes' => @filesize($path) ?: null,
            'image_width' => null,
            'image_height' => null,
            'image_dpi' => null,
            'mime_type' => null,
        ];

        if (function_exists('getimagesize')) {
            $info = @getimagesize($path);
            if (is_array($info)) {
                $meta['image_width'] = $info[0] ?? null;
                $meta['image_height'] = $info[1] ?? null;
                $meta['mime_type'] = $info['mime'] ?? null;
                if (isset($info[0], $info[1]) && $info[0] > 0) {
                    $meta['image_dpi'] = round(min($info[0], $info[1]) / 8.5);
                }
            }
        }

        return $meta;
    }

    private function newDebugContext(DeliveryDocument $document, string $diskPath): array
    {
        return array_merge([
            'document_id' => $document->id,
            'filename' => basename($diskPath),
            'disk_path' => $diskPath,
            'preprocessed_path' => null,
            'preprocess_steps' => [],
            'debug_artifacts' => [],
            'tesseract_command' => null,
            'tesseract_oem' => null,
            'tesseract_psm' => null,
            'execution_time_ms' => null,
            'multipass_report' => [],
        ], $this->imageMeta($diskPath));
    }

    private function writeDebugReport(
        OcrResult $result,
        array $debugContext,
        string $rawText,
        ?float $confidence,
        array $parsed,
        array $dataset,
        ?array $validation = null,
        ?string $errorMessage = null
    ): void {
        $hasStructured = collect($dataset)->filter(static fn ($v) => $v !== null && $v !== '')->isNotEmpty();
        $textExtracted = trim($rawText) !== '';
        $parserStatus = $result->ocr_diagnostics['parser_status'] ?? 'unknown';

        $failureStage = 'none';
        if ($errorMessage || $result->processing_status === self::STATUS_FAILED) {
            $failureStage = 'ocr_execution';
        } elseif (! $textExtracted) {
            $failureStage = 'raw_text_extraction';
        } elseif ($parserStatus === 'parser_miss') {
            $failureStage = 'parser';
        } elseif (! $hasStructured) {
            $failureStage = 'dataset_mapping';
        }

        $this->debugLogger->log([
            'timestamp' => now()->toDateTimeString(),
            'document_id' => $debugContext['document_id'] ?? $result->document_id,
            'ocr_result_id' => $result->id,
            'filename' => $debugContext['filename'] ?? 'unknown',
            'file_size_bytes' => $debugContext['file_size_bytes'] ?? null,
            'image_width' => $debugContext['image_width'] ?? null,
            'image_height' => $debugContext['image_height'] ?? null,
            'image_dpi' => $debugContext['image_dpi'] ?? null,
            'mime_type' => $debugContext['mime_type'] ?? null,
            'preprocess_steps' => $debugContext['preprocess_steps'] ?? [],
            'preprocessed_path' => $debugContext['preprocessed_path'] ?? null,
            'debug_artifacts' => $debugContext['debug_artifacts'] ?? [],
            'engine' => $result->engine,
            'tesseract_oem' => $debugContext['tesseract_oem'] ?? null,
            'tesseract_psm' => $debugContext['tesseract_psm'] ?? null,
            'tesseract_command' => $debugContext['tesseract_command'] ?? null,
            'execution_time_ms' => $debugContext['execution_time_ms'] ?? null,
            'ocr_confidence' => $confidence !== null ? number_format($confidence * 100, 2).'%' : 'n/a',
            'multipass_report' => $debugContext['multipass_report'] ?? [],
            'text_length' => strlen(trim($rawText)),
            'raw_ocr_output' => $textExtracted ? $rawText : '[empty]',
            'parser_version' => $parsed['meta']['parser_version'] ?? 'adaptive-v2',
            'parser_status' => $parserStatus,
            'regex_matches' => $parsed['matches'] ?? [],
            'parsed_fields' => array_merge($dataset, $parsed['auxiliary'] ?? []),
            'field_confidence' => $parsed['field_confidence'] ?? [],
            'review_suggestions' => $parsed['meta']['review_suggestions'] ?? [],
            'mapped_dataset' => $dataset,
            'database_values' => [
                'extracted_length' => $result->extracted_length,
                'extracted_width' => $result->extracted_width,
                'extracted_height' => $result->extracted_height,
                'extracted_volume' => $result->extracted_volume,
                'delivery_receipt_number' => $result->delivery_receipt_number,
            ],
            'validation_results' => $validation ?? ($result->ocr_diagnostics['validation'] ?? []),
            'ocr_executed' => $result->processing_status !== self::STATUS_PENDING,
            'text_extracted' => $textExtracted,
            'parser_executed' => true,
            'dataset_mapping_ok' => $hasStructured,
            'processing_status' => $result->processing_status,
            'failure_stage' => $failureStage,
            'error_message' => $errorMessage ?: $result->error_message,
        ]);
    }
}
