<?php

namespace App\Console\Commands;

use App\Services\Ocr\OcrService;
use Illuminate\Console\Command;
use ReflectionClass;
use Symfony\Component\Process\Process;

class OcrCheckCommand extends Command
{
    protected $signature = 'ocr:check';

    protected $description = 'Verify Tesseract OCR is visible to PHP (PATH or TESSERACT_PATH)';

    public function handle(): int
    {
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
}
