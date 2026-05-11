<?php

namespace App\Services\Ocr;

use App\Models\DeliveryDocument;
use App\Models\OcrResult;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Throwable;

class OcrService
{
    /**
     * Create a placeholder result used before async OCR runs.
     */
    public function createPending(DeliveryDocument $document): OcrResult
    {
        return OcrResult::query()->create([
            'document_id' => $document->id,
            'processing_status' => 'pending',
            'extracted_text' => null,
            'corrected_text' => null,
            'confidence_score' => null,
            'engine' => null,
            'error_message' => null,
            'is_validated' => false,
        ]);
    }

    /**
     * Run extraction synchronously (queue worker or admin "reprocess").
     */
    public function process(DeliveryDocument $document): OcrResult
    {
        $result = $document->ocrResult;
        if (! $result) {
            $result = $this->createPending($document);
        }

        $result->forceFill([
            'processing_status' => 'processing',
            'error_message' => null,
        ])->save();

        $diskPath = Storage::disk('public')->path($document->file_path);

        if (! is_readable($diskPath)) {
            return $this->fail($result, 'Stored file is not readable.');
        }

        $ext = strtolower(pathinfo($diskPath, PATHINFO_EXTENSION));
        if (in_array($ext, ['pdf'], true)) {
            return $this->fail(
                $result,
                'PDF OCR is not enabled in this deployment. Convert to JPG/PNG or add a PDF rasterizer pipeline.'
            );
        }

        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tif', 'tiff', 'bmp'], true)) {
            return $this->fail($result, 'Unsupported image type for local OCR: '.$ext);
        }

        $tesseract = (new ExecutableFinder)->find('tesseract', null, ['C:\\Program Files\\Tesseract-OCR']);

        if (! $tesseract) {
            return $this->fallbackDemoExtraction($result, $document, $diskPath);
        }

        try {
            $process = new Process([$tesseract, $diskPath, 'stdout', '-l', 'eng']);
            $process->setTimeout(120);
            $process->run();

            if (! $process->isSuccessful()) {
                return $this->fail($result, trim($process->getErrorOutput() ?: 'Tesseract failed.'));
            }

            $text = trim($process->getOutput());
            $result->forceFill([
                'processing_status' => 'completed',
                'extracted_text' => $text !== '' ? $text : null,
                'confidence_score' => $text !== '' ? 0.75 : null,
                'engine' => 'tesseract',
            ])->save();

            return $result->fresh();
        } catch (Throwable $e) {
            return $this->fail($result, $e->getMessage());
        }
    }

    /**
     * When Tesseract is not installed, store a clear stub so QA environments still exercise the pipeline.
     */
    private function fallbackDemoExtraction(OcrResult $result, DeliveryDocument $document, string $diskPath): OcrResult
    {
        $stub = sprintf(
            "[OCR stub — install Tesseract and ensure it is on PATH]\nDocument #%d (%s)\nFile: %s\nBytes: %d",
            $document->id,
            $document->type,
            basename($diskPath),
            @filesize($diskPath) ?: 0
        );

        $result->forceFill([
            'processing_status' => 'completed',
            'extracted_text' => $stub,
            'confidence_score' => null,
            'engine' => 'stub',
            'error_message' => null,
        ])->save();

        return $result->fresh();
    }

    private function fail(OcrResult $result, string $message): OcrResult
    {
        $result->forceFill([
            'processing_status' => 'failed',
            'error_message' => $message,
            'engine' => $result->engine,
        ])->save();

        return $result->fresh();
    }
}
