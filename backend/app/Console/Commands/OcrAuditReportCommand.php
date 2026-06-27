<?php

namespace App\Console\Commands;

use App\Models\OcrResult;
use Illuminate\Console\Command;

class OcrAuditReportCommand extends Command
{
    protected $signature = 'ocr:audit-report {--days=30 : Limit report to last N days}';

    protected $description = 'Generate OCR / parser / dataset mapping success rates and root-cause summary';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $query = OcrResult::query()->where('created_at', '>=', now()->subDays($days));

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->warn('No OCR records found for the selected window.');

            return self::SUCCESS;
        }

        $ocrExecuted = (clone $query)->whereIn('processing_status', ['processed', 'needs_review', 'validated', 'completed', 'failed'])->count();
        $textExtracted = (clone $query)->whereNotNull('extracted_text')->where('extracted_text', 'not like', '(No text detected%')->count();
        $parserSuccess = (clone $query)->where(function ($q): void {
            $q->whereNotNull('extracted_length')
                ->orWhereNotNull('extracted_width')
                ->orWhereNotNull('extracted_height')
                ->orWhereNotNull('extracted_volume')
                ->orWhereNotNull('delivery_receipt_number');
        })->count();
        $mappingSuccess = (clone $query)->whereNotNull('delivery_receipt_number')
            ->whereNotNull('extracted_length')
            ->whereNotNull('extracted_width')
            ->whereNotNull('extracted_height')
            ->count();

        $parserMiss = (clone $query)->whereJsonContains('ocr_diagnostics->parser_status', 'parser_miss')->count();
        $noText = (clone $query)->whereJsonContains('ocr_diagnostics->parser_status', 'no_text')->count();
        $partial = (clone $query)->whereJsonContains('ocr_diagnostics->parser_status', 'partial')->count();
        $failed = (clone $query)->where('processing_status', 'failed')->count();

        $this->line('====================');
        $this->line('OCR AUDIT REPORT');
        $this->line('====================');
        $this->line('Window: last '.$days.' day(s)');
        $this->line('Total documents: '.$total);
        $this->newLine();
        $this->line('OCR SUCCESS RATE: '.$this->pct($ocrExecuted, $total));
        $this->line('Parser SUCCESS RATE: '.$this->pct($parserSuccess, $total));
        $this->line('Dataset Mapping SUCCESS RATE: '.$this->pct($mappingSuccess, $total));
        $this->newLine();
        $this->line('Root-cause split:');
        $this->line('- Regex extraction failed (parser_miss): '.$parserMiss);
        $this->line('- OCR produced no text (no_text): '.$noText);
        $this->line('- Partial extraction: '.$partial);
        $this->line('- Hard failures: '.$failed);
        $this->newLine();
        $this->line('Recommended OCR engine: '.((string) config('ocr.engine', 'remote')));
        $this->line('Recommended Tesseract PSM/OEM: '.implode(',', (array) config('ocr.remote_psm_candidates', ['3', '4', '6', '11', '12'])).' / OEM 3');

        return self::SUCCESS;
    }

    private function pct(int $part, int $total): string
    {
        if ($total <= 0) {
            return '0.00% (0/0)';
        }

        return number_format(($part / $total) * 100, 2)."% ({$part}/{$total})";
    }
}
