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
            $this->line('  1. Set TESSERACT_PATH in backend/.env to the full path, e.g.');
            $this->line('     TESSERACT_PATH="C:\\Program Files\\Tesseract-OCR\\tesseract.exe"');
            $this->line('  2. Restart the terminal and run: php artisan serve');
            $this->line('  3. In Admin → OCR Validation, click Reprocess OCR on a document');

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
