<?php

namespace App\Services\Ocr;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Runs Tesseract with multiple OEM/PSM combinations and selects the best result.
 */
class TesseractMultipassEngine
{
    /** @return array{text:string,confidence:?float,command:string,oem:int,psm:int,execution_time_ms:int,multipass_report:list<array<string,mixed>>}|null */
    public function run(string $imagePath, ?string $tesseractBinary = null): ?array
    {
        $tesseract = $tesseractBinary ?? $this->resolveTesseractBinary();
        if (! $tesseract) {
            return null;
        }

        $oemCandidates = array_map('intval', (array) config('ocr.tesseract_oem_candidates', [3, 1, 0]));
        $psmCandidates = array_map('intval', (array) config('ocr.tesseract_psm_candidates', [6, 4, 3, 11, 12]));
        $maxPasses = max(1, (int) config('ocr.tesseract_max_passes', 15));
        $lang = trim((string) config('ocr.tesseract_lang', 'eng')) ?: 'eng';

        $best = null;
        $bestScore = -1.0;
        $report = [];
        $passes = 0;

        foreach ($oemCandidates as $oem) {
            foreach ($psmCandidates as $psm) {
                if ($passes >= $maxPasses) {
                    break 2;
                }

                $started = microtime(true);
                $result = $this->runSingle($tesseract, $imagePath, $oem, $psm, $lang);
                $elapsedMs = (int) round((microtime(true) - $started) * 1000);
                $passes++;

                if ($result === null) {
                    $report[] = [
                        'oem' => $oem,
                        'psm' => $psm,
                        'score' => 0,
                        'text_length' => 0,
                        'execution_time_ms' => $elapsedMs,
                        'error' => 'failed',
                    ];
                    continue;
                }

                $score = $this->scoreOcrOutput($result['text'], $result['confidence']);
                $report[] = [
                    'oem' => $oem,
                    'psm' => $psm,
                    'score' => round($score, 4),
                    'text_length' => strlen($result['text']),
                    'execution_time_ms' => $elapsedMs,
                    'confidence' => $result['confidence'],
                ];

                if ($score > $bestScore) {
                    $bestScore = $score;
                    $best = array_merge($result, [
                        'oem' => $oem,
                        'psm' => $psm,
                        'execution_time_ms' => $elapsedMs,
                        'multipass_report' => [],
                    ]);
                }

                if ($score >= (float) config('ocr.tesseract_early_exit_score', 0.72)) {
                    break 2;
                }
            }
        }

        if ($best === null) {
            return null;
        }

        $best['multipass_report'] = $report;
        $best['command'] = sprintf(
            '%s %s stdout --oem %d --psm %d -l %s',
            $tesseract,
            $imagePath,
            $best['oem'],
            $best['psm'],
            $lang
        );

        return $best;
    }

    /** @return array{text:string,confidence:?float}|null */
    private function runSingle(string $tesseract, string $imagePath, int $oem, int $psm, string $lang): ?array
    {
        try {
            $cmd = [$tesseract, $imagePath, 'stdout', '--oem', (string) $oem, '-l', $lang, '--psm', (string) $psm];
            $process = new Process($cmd);
            $process->setTimeout(max(30, (int) config('ocr.tesseract_timeout', 120)));
            $process->run();

            if (! $process->isSuccessful()) {
                return null;
            }

            $text = trim($process->getOutput());

            return [
                'text' => $text,
                'confidence' => $this->estimateConfidence($text),
            ];
        } catch (Throwable $e) {
            Log::debug('Tesseract pass failed', ['oem' => $oem, 'psm' => $psm, 'error' => $e->getMessage()]);

            return null;
        }
    }

    private function scoreOcrOutput(string $text, ?float $confidence): float
    {
        $len = strlen(trim($text));
        if ($len === 0) {
            return 0.0;
        }

        $score = min(1.0, $len / 400.0) * 0.5;
        $score += ($confidence ?? 0.5) * 0.3;

        $keywords = ['delivery', 'receipt', 'length', 'width', 'height', 'volume', 'dr', 'truck', 'plate'];
        $lower = strtolower($text);
        $hits = 0;
        foreach ($keywords as $kw) {
            if (str_contains($lower, $kw)) {
                $hits++;
            }
        }
        $score += min(0.2, $hits * 0.03);

        if (preg_match('/\d{5,}/', $text)) {
            $score += 0.05;
        }

        return $score;
    }

    private function estimateConfidence(string $text): ?float
    {
        $len = strlen(trim($text));
        if ($len === 0) {
            return null;
        }

        return match (true) {
            $len > 200 => 0.88,
            $len > 80 => 0.75,
            $len > 30 => 0.62,
            default => 0.45,
        };
    }

    public function resolveTesseractBinary(): ?string
    {
        $configured = config('ocr.tesseract_path');
        if (is_string($configured) && $configured !== '' && is_file($configured)) {
            return $configured;
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
            if ($found && is_file($found)) {
                return $found;
            }
        }

        return null;
    }
}
