<?php

namespace App\Services\Ocr;

use Google\ApiCore\ApiException;
use Google\Cloud\DocumentAI\V1\Client\DocumentProcessorServiceClient;
use Google\Cloud\DocumentAI\V1\Document;
use Google\Cloud\DocumentAI\V1\ProcessRequest;
use Google\Cloud\DocumentAI\V1\RawDocument;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class GoogleDocumentAiService
{
    /**
     * @return array{
     *   text:string,
     *   confidence:?float,
     *   engine:string,
     *   diagnostics:array<string,mixed>,
     *   command:string
     * }
     */
    public function extractFromImage(string $diskPath): array
    {
        $credentialsPath = $this->resolveCredentialsPath((string) config('services.document_ai.credentials', ''));
        $projectId = trim((string) config('services.document_ai.project', ''));
        $location = trim((string) config('services.document_ai.location', 'us'));
        $processorId = trim((string) config('services.document_ai.processor_id', ''));
        $timeout = max(5, (int) config('services.document_ai.timeout', 30));

        if ($credentialsPath === '' || ! is_file($credentialsPath) || ! is_readable($credentialsPath)) {
            throw new RuntimeException('Google Document AI credentials file is missing or unreadable.');
        }
        if ($projectId === '' || $processorId === '') {
            throw new RuntimeException('Google Document AI project/processor configuration is incomplete.');
        }
        if (! is_file($diskPath) || ! is_readable($diskPath)) {
            throw new RuntimeException('OCR source file is missing or unreadable.');
        }

        $mimeType = $this->mimeTypeFromPath($diskPath);
        $contents = @file_get_contents($diskPath);
        if (! is_string($contents) || $contents === '') {
            throw new RuntimeException('Could not read OCR source file contents.');
        }

        $processorName = sprintf(
            'projects/%s/locations/%s/processors/%s',
            $projectId,
            $location,
            $processorId
        );

        $client = null;
        try {
            $client = new DocumentProcessorServiceClient($this->clientOptions($location, $credentialsPath));

            $request = new ProcessRequest([
                'name' => $processorName,
                'raw_document' => new RawDocument([
                    'content' => $contents,
                    'mime_type' => $mimeType,
                    'display_name' => basename($diskPath),
                ]),
                'skip_human_review' => true,
            ]);

            $response = $client->processDocument($request, [
                'timeoutMillis' => $timeout * 1000,
            ]);
            $document = $response->getDocument();
            if (! $document instanceof Document) {
                throw new RuntimeException('Document AI returned an empty document payload.');
            }

            $text = trim((string) $document->getText());
            $confidence = $this->extractAverageEntityConfidence($document);

            return [
                'text' => $text,
                'confidence' => $confidence,
                'engine' => 'google-document-ai',
                'command' => 'google.documentai.processDocument',
                'diagnostics' => [
                    'provider' => 'document_ai',
                    'processor_name' => $processorName,
                    'mime_type' => $mimeType,
                    'transport' => $this->configuredTransport(),
                    'entities_count' => count($document->getEntities()),
                    'pages_count' => count($document->getPages()),
                ],
            ];
        } catch (ApiException $e) {
            Log::warning('Google Document AI request failed', [
                'error' => $e->getMessage(),
                'status' => $e->getStatus(),
                'processor' => $processorName,
            ]);
            throw new RuntimeException('Google Document AI request failed: '.$e->getMessage(), 0, $e);
        } catch (Throwable $e) {
            Log::warning('Google Document AI processing failed', [
                'error' => $e->getMessage(),
                'processor' => $processorName,
            ]);
            throw new RuntimeException('Google Document AI processing failed: '.$e->getMessage(), 0, $e);
        } finally {
            if ($client instanceof DocumentProcessorServiceClient) {
                $client->close();
            }
        }
    }

    private function mimeTypeFromPath(string $diskPath): string
    {
        return match (strtolower((string) pathinfo($diskPath, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'tif', 'tiff' => 'image/tiff',
            'bmp' => 'image/bmp',
            default => 'application/octet-stream',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function clientOptions(string $location, string $credentialsPath): array
    {
        return [
            'apiEndpoint' => sprintf('%s-documentai.googleapis.com', $location),
            'credentials' => $credentialsPath,
            'transport' => $this->configuredTransport(),
        ];
    }

    private function configuredTransport(): string
    {
        $transport = strtolower(trim((string) config('services.document_ai.transport', 'rest')));

        return in_array($transport, ['rest', 'grpc', 'grpc-fallback'], true) ? $transport : 'rest';
    }

    private function resolveCredentialsPath(string $configuredPath): string
    {
        $configuredPath = trim($configuredPath);
        if ($configuredPath === '') {
            return '';
        }

        $normalized = str_replace('\\', '/', $configuredPath);
        $isAbsolute = str_starts_with($normalized, '/')
            || preg_match('/^[A-Za-z]:\//', $normalized) === 1;

        if ($isAbsolute) {
            return $configuredPath;
        }

        return base_path($configuredPath);
    }

    private function extractAverageEntityConfidence(Document $document): ?float
    {
        $entities = $document->getEntities();
        if (count($entities) === 0) {
            return null;
        }

        $sum = 0.0;
        $count = 0;
        foreach ($entities as $entity) {
            $confidence = $entity->getConfidence();
            if (! is_numeric($confidence)) {
                continue;
            }
            $sum += (float) $confidence;
            $count++;
        }

        if ($count === 0) {
            return null;
        }

        return round($sum / $count, 4);
    }
}

