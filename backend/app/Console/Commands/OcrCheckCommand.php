<?php

namespace App\Console\Commands;

use App\Services\Ocr\OcrService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use ReflectionClass;
use Symfony\Component\Process\Process;

class OcrCheckCommand extends Command
{
    protected $signature = 'ocr:check';

    protected $description = 'Verify OCR configuration for local Tesseract or remote Render OCR';

    public function handle(): int
    {
        $engine = strtolower((string) config('ocr.engine', 'local'));
        $this->line('OCR_ENGINE: '.$engine);

        if ($engine === 'remote') {
            return $this->checkRemote();
        }

        $configured = config('ocr.tesseract_path');
        $this->line('TESSERACT_PATH (.env): '.($configured ?: '(not set)'));

        $service = app(OcrService::class);
        $method  = (new ReflectionClass($service))->getMethod('resolveTesseractBinary');
        $method->setAccessible(true);
        $binary = $method->invoke($service);

        if (! $binary) {
            $this->error('Tesseract was NOT found by the OCR service.');
            $this->newLine();
            $this->line('Try:');
            $this->line('  1. Install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki');
            $this->line('  2. Set TESSERACT_PATH in backend/.env, e.g.');
            $this->line('     TESSERACT_PATH="C:/Program Files/Tesseract-OCR/tesseract.exe"');
            $this->line('  3. Run: php artisan serve  (restart after .env change)');
            $this->line('  4. Optional demo mode: OCR_SYNC_MODE=true (processes OCR on upload)');
            $this->line('  5. Admin → OCR Validation → Reprocess OCR on a document');

            return self::FAILURE;
        }

        $this->info('Resolved binary: '.$binary);

        $process = new Process([$binary, '--version']);
        $process->run();
        if ($process->isSuccessful()) {
            $this->line(trim($process->getOutput()));
        } else {
            $this->warn('Binary found but --version failed: '.trim($process->getErrorOutput()));
        }

        $this->newLine();
        $this->info('OCR is ready. Upload a document or reprocess an existing one.');

        return self::SUCCESS;
    }

    private function checkRemote(): int
    {
        $url = trim((string) config('ocr.remote_url'));
        $token = trim((string) config('ocr.remote_token'));
        $timeout = max(10, (int) config('ocr.remote_timeout', 180));

        $this->line('OCR_REMOTE_URL: '.($url ?: '(not set)'));
        $this->line('OCR_REMOTE_TOKEN: '.($token !== '' ? '(set)' : '(not set)'));

        if ($url === '' || $token === '') {
            $this->error('Remote OCR is not configured. Set OCR_REMOTE_URL and OCR_REMOTE_TOKEN.');

            return self::FAILURE;
        }

        $healthUrl = preg_replace('#/ocr/?$#', '/health', $url) ?: $url;

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withToken($token)
                ->get($healthUrl);
        } catch (\Throwable $e) {
            $this->error('Remote OCR health check failed: '.$e->getMessage());

            return self::FAILURE;
        }

        if (! $response->successful()) {
            $this->error('Remote OCR health check returned HTTP '.$response->status().': '.trim($response->body()));

            return self::FAILURE;
        }

        $this->info('Remote OCR is reachable.');
        $this->line(trim($response->body()));

        return self::SUCCESS;
    }
}
