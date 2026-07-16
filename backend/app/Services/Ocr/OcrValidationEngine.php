<?php

namespace App\Services\Ocr;

use App\Models\DispatchAssignment;
use App\Models\OcrResult;

/**
 * Cross-checks OCR extracted values against assignment / job order system data.
 */
class OcrValidationEngine
{
    private const VOLUME_TOLERANCE = 0.15;

    private const PLATE_NORMALIZE_PATTERN = '/[^A-Z0-9]/';

    /**
     * @param  array<string, mixed>  $extracted
     * @return array<string, mixed>
     */
    public function validate(OcrResult $result, array $extracted, ?DispatchAssignment $assignment = null): array
    {
        $assignment ??= $result->assignment;
        if ($assignment) {
            $assignment->loadMissing('driver.user', 'vehicle', 'jobOrder');
        }

        $job = $assignment?->jobOrder;
        $fields = [];
        $mismatches = [];
        $warnings = [];

        $expectedVolume = (float) ($job?->load_volume_m3 ?? $job?->volume_m3 ?? 0);
        $actualVolume = isset($extracted['volume']) ? (float) $extracted['volume'] : null;

        if ($expectedVolume > 0 && $actualVolume !== null && $actualVolume > 0) {
            $delta = abs($expectedVolume - $actualVolume) / $expectedVolume;
            $ok = $delta <= self::VOLUME_TOLERANCE;
            $fields['volume'] = [
                'field' => 'volume',
                'ocr_value' => $actualVolume,
                'system_value' => $expectedVolume,
                'delta_ratio' => round($delta, 4),
                'status' => $ok ? 'match' : 'mismatch',
                'message' => $ok
                    ? 'Volume matches job order within tolerance.'
                    : sprintf('Volume differs by %.1f%% from job order.', $delta * 100),
            ];
            if (! $ok) {
                $mismatches[] = 'volume';
            }
        } elseif ($actualVolume === null) {
            $warnings[] = 'volume_not_extracted';
        }

        $systemPlate = strtoupper(trim((string) ($assignment?->vehicle?->plate_no ?? $result->vehicle_plate_no ?? '')));
        $ocrPlate = $this->extractPlateFromText($extracted);
        if ($systemPlate !== '' && $ocrPlate !== null) {
            $ok = $this->platesMatch($systemPlate, $ocrPlate);
            $fields['vehicle_plate'] = [
                'field' => 'vehicle_plate',
                'ocr_value' => $ocrPlate,
                'system_value' => $systemPlate,
                'status' => $ok ? 'match' : 'mismatch',
                'message' => $ok ? 'Plate number matches assigned vehicle.' : 'Plate number differs from assigned vehicle.',
            ];
            if (! $ok) {
                $mismatches[] = 'vehicle_plate';
            }
        }

        $systemDriver = trim((string) ($assignment?->driver?->full_name ?: $assignment?->driver?->user?->name ?? $result->driver_name ?? ''));
        $ocrDriver = isset($extracted['driver_name']) ? trim((string) $extracted['driver_name']) : null;
        if ($systemDriver !== '' && $ocrDriver !== null && $ocrDriver !== '') {
            $ok = $this->namesSimilar($systemDriver, $ocrDriver);
            $fields['driver_name'] = [
                'field' => 'driver_name',
                'ocr_value' => $ocrDriver,
                'system_value' => $systemDriver,
                'status' => $ok ? 'match' : 'mismatch',
                'message' => $ok ? 'Driver name matches assignment.' : 'Driver name differs from assigned driver.',
            ];
            if (! $ok) {
                $mismatches[] = 'driver_name';
            }
        }

        $systemTracking = strtoupper(trim((string) ($job?->tracking_code ?? '')));
        $ocrReceipt = strtoupper(trim((string) ($extracted['delivery_receipt_number'] ?? '')));
        if ($systemTracking !== '' && $ocrReceipt !== '') {
            $ok = str_contains($ocrReceipt, $systemTracking) || str_contains($systemTracking, preg_replace('/^DR-?/', '', $ocrReceipt));
            $fields['delivery_receipt_number'] = [
                'field' => 'delivery_receipt_number',
                'ocr_value' => $ocrReceipt,
                'system_value' => $systemTracking,
                'status' => $ok ? 'partial_match' : 'mismatch',
                'message' => $ok
                    ? 'Receipt number may relate to job tracking code.'
                    : 'Receipt number does not match job tracking code.',
            ];
        }

        $hasDims = ($extracted['length'] ?? null) !== null
            && ($extracted['width'] ?? null) !== null
            && ($extracted['height'] ?? null) !== null;

        $overall = 'partial';
        if ($mismatches !== []) {
            $overall = 'mismatch';
        } elseif ($hasDims && ($extracted['delivery_receipt_number'] ?? null) !== null) {
            $overall = 'matched';
        } elseif (! $hasDims && ($extracted['delivery_receipt_number'] ?? null) === null) {
            $overall = 'empty';
        }

        return [
            'overall_status' => $overall,
            'fields' => $fields,
            'mismatches' => $mismatches,
            'warnings' => $warnings,
            'requires_manual_review' => $mismatches !== [] || $warnings !== [] || ! $hasDims,
        ];
    }

    /**
     * @param  array<string, mixed>  $extracted
     */
    private function extractPlateFromText(array $extracted): ?string
    {
        if (isset($extracted['vehicle_plate']) && $extracted['vehicle_plate'] !== '') {
            return strtoupper(trim((string) $extracted['vehicle_plate']));
        }

        return null;
    }

    private function platesMatch(string $system, string $ocr): bool
    {
        $a = preg_replace(self::PLATE_NORMALIZE_PATTERN, '', strtoupper($system));
        $b = preg_replace(self::PLATE_NORMALIZE_PATTERN, '', strtoupper($ocr));

        return $a !== '' && $b !== '' && ($a === $b || str_contains($a, $b) || str_contains($b, $a));
    }

    private function namesSimilar(string $a, string $b): bool
    {
        $na = strtolower(preg_replace('/\s+/', ' ', trim($a)) ?? $a);
        $nb = strtolower(preg_replace('/\s+/', ' ', trim($b)) ?? $b);

        if ($na === $nb) {
            return true;
        }

        $partsA = explode(' ', $na);
        $partsB = explode(' ', $nb);

        return in_array($partsA[0], $partsB, true) || in_array($partsB[0], $partsA, true);
    }
}
