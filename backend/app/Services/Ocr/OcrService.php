<?php

namespace App\Services\Ocr;

use App\Models\DeliveryDocument;
use App\Models\OcrResult;
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
        return OcrResult::query()->updateOrCreate(
            ['document_id' => $document->id],
            [
                'processing_status' => self::STATUS_PENDING,
                'extracted_text'    => null,
                'corrected_text'    => null,
                'confidence_score'  => null,
                'engine'            => null,
                'error_message'     => null,
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

            $text = trim($process->getOutput());
            $confidence = $this->estimateConfidence($text);
            $displayText = $text !== '' ? $text : '(No text detected — image may be blank or low contrast.)';

            $status = self::STATUS_PROCESSED;
            if ($text === '' || ($confidence !== null && $confidence < 0.65)) {
                $status = self::STATUS_NEEDS_REVIEW;
            }

            $result->forceFill([
                'processing_status'  => $status,
                'extracted_text'     => $displayText,
                'corrected_text'     => null,
                'confidence_score'   => $confidence,
                'engine'             => 'tesseract',
                'error_message'      => null,
            ])->save();

            return $result->fresh();
        } catch (Throwable $e) {
            Log::error('OCR processing exception', ['document_id' => $document->id, 'error' => $e->getMessage()]);

            return $this->fail($result, $e->getMessage());
        }
    }

    public function isTesseractAvailable(): bool
    {
        return $this->resolveTesseractBinary() !== null;
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
            'extracted_text'     => $stub,
            'corrected_text'     => null,
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
            'error_message'     => $message,
        ])->save();

        return $result->fresh();
    }
}
