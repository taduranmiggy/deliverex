<?php

namespace App\Services\Ocr;

/**
 * Honest weighted confidence model — no text-length buckets, no hardcoded scores.
 */
class OcrConfidenceScorer
{
  /** @return array<string, float> */
  public function defaultWeights(): array
  {
    return (array) config('ocr.confidence_weights', [
      'provider_ocr' => 0.28,
      'text_quality' => 0.07,
      'dimension_extraction' => 0.18,
      'receipt_pattern' => 0.12,
      'field_completeness' => 0.20,
      'volume_cross_validation' => 0.08,
      'table_detection' => 0.04,
      'auxiliary_fields' => 0.03,
    ]);
  }

  /**
   * @param  array<string, mixed>  $providerSignals
   * @param  array<string, mixed>  $parsed  extractStructuredFieldsWithDebug result
   */
  public function compute(string $text, array $providerSignals, array $parsed): array
  {
    $weights = $this->defaultWeights();
    $values = $parsed['values'] ?? [];
    $meta = $parsed['meta'] ?? [];
    $matches = $parsed['matches'] ?? [];

    if (trim($text) === '' || str_starts_with(trim($text), '(No text detected')) {
      return $this->result(0.05, $weights, [
        'provider_ocr' => 0.0,
        'text_quality' => 0.0,
        'dimension_extraction' => 0.0,
        'receipt_pattern' => 0.0,
        'field_completeness' => 0.0,
        'volume_cross_validation' => 0.0,
        'table_detection' => 0.0,
        'auxiliary_fields' => 0.0,
      ], []);
    }

    $textQuality = $this->textQualitySignal($text);
    $rawProvider = isset($providerSignals['entity_confidence_avg']) && is_numeric($providerSignals['entity_confidence_avg'])
      ? (float) $providerSignals['entity_confidence_avg']
      : (isset($providerSignals['provider_ocr']) && is_numeric($providerSignals['provider_ocr'])
        ? (float) $providerSignals['provider_ocr']
        : null);

    $providerOcr = $rawProvider;
    if ($providerOcr === null) {
      $providerOcr = min(0.55, $textQuality * 0.85);
    }

    $dimensionScore = isset($matches['parser_score']) && is_numeric($matches['parser_score'])
      ? min(1.0, max(0.0, ((float) $matches['parser_score']) / 6.0))
      : 0.0;

    $breakdown = $meta['confidence_breakdown'] ?? [];
    $receiptPattern = isset($breakdown['delivery_receipt_number']) && is_numeric($breakdown['delivery_receipt_number'])
      ? min(1.0, max(0.0, (float) $breakdown['delivery_receipt_number']))
      : 0.0;

    $coreFields = ['length', 'width', 'height', 'volume', 'delivery_receipt_number'];
    $filled = 0;
    foreach ($coreFields as $field) {
      if (($values[$field] ?? null) !== null && $values[$field] !== '') {
        $filled++;
      }
    }
    $fieldCompleteness = $filled / count($coreFields);

    $volumeCross = $this->volumeCrossValidationSignal($values);
    $tableDetection = $this->tableDetectionSignal($providerSignals, $matches);
    $auxiliary = $this->auxiliaryFieldsSignal($meta['review_suggestions'] ?? []);

    $signals = [
      'provider_ocr' => round($providerOcr, 4),
      'text_quality' => round($textQuality, 4),
      'dimension_extraction' => round($dimensionScore, 4),
      'receipt_pattern' => round($receiptPattern, 4),
      'field_completeness' => round($fieldCompleteness, 4),
      'volume_cross_validation' => round($volumeCross, 4),
      'table_detection' => round($tableDetection, 4),
      'auxiliary_fields' => round($auxiliary, 4),
    ];

    $weighted = 0.0;
    foreach ($signals as $key => $value) {
      $weight = (float) ($weights[$key] ?? 0.0);
      $weighted += $weight * $value;
    }

    $final = max(0.05, min(0.99, $weighted));

    if ($rawProvider === null && $fieldCompleteness < 0.6) {
      $final = min($final, 0.82);
    }

    if ($rawProvider !== null && $rawProvider < 0.7) {
      $final = min($final, $rawProvider + 0.12);
    }

    $fieldScores = $this->fieldScores($values, $breakdown, $dimensionScore, $receiptPattern, $meta['review_suggestions'] ?? []);

    return $this->result(round($final, 4), $weights, $signals, $fieldScores);
  }

  /**
   * @param  array<string, float>  $weights
   * @param  array<string, float>  $signals
   * @param  array<string, float>  $fieldScores
   * @return array{final:float, confidence_model:array<string,mixed>}
   */
  private function result(float $final, array $weights, array $signals, array $fieldScores): array
  {
    return [
      'final' => $final,
      'confidence_model' => [
        'version' => 'weighted-v1',
        'final' => $final,
        'signals' => $signals,
        'weights' => $weights,
        'field_scores' => $fieldScores,
      ],
    ];
  }

  private function textQualitySignal(string $text): float
  {
    $trimmed = trim($text);
    if ($trimmed === '') {
      return 0.0;
    }

    $len = strlen($trimmed);
    $alnum = 0;
    $lines = max(1, substr_count($trimmed, "\n") + 1);

    for ($i = 0; $i < $len; $i++) {
      if (ctype_alnum($trimmed[$i])) {
        $alnum++;
      }
    }

    $ratio = $alnum / max(1, $len);
    $lineBonus = min(0.15, ($lines - 1) * 0.03);

    return min(1.0, max(0.1, ($ratio * 0.85) + $lineBonus));
  }

  /**
   * @param  array<string, mixed>  $values
   */
  private function volumeCrossValidationSignal(array $values): float
  {
    $length = $values['length'] ?? null;
    $width = $values['width'] ?? null;
    $height = $values['height'] ?? null;
    $volume = $values['volume'] ?? null;

    if ($length === null || $width === null || $height === null) {
      return 0.0;
    }

    if ($volume === null || (float) $volume <= 0) {
      return 0.5;
    }

    $calc = (float) $length * (float) $width * (float) $height;
    $delta = abs($calc - (float) $volume) / max((float) $volume, 0.0001);

    if ($delta <= 0.10) {
      return 1.0;
    }
    if ($delta >= 0.20) {
      return 0.0;
    }

    return max(0.0, 1.0 - (($delta - 0.10) / 0.10));
  }

  /**
   * @param  array<string, mixed>  $providerSignals
   * @param  array<string, mixed>  $matches
   */
  private function tableDetectionSignal(array $providerSignals, array $matches): float
  {
    $tables = (int) ($providerSignals['tables_count'] ?? 0);
    if ($tables > 0) {
      return 1.0;
    }

    $source = (string) ($matches['parser_source'] ?? '');
    if (in_array($source, ['structured_tabular', 'structured_column'], true)) {
      return 1.0;
    }

    return 0.0;
  }

  /**
   * @param  array<string, mixed>  $reviewSuggestions
   */
  private function auxiliaryFieldsSignal(array $reviewSuggestions): float
  {
    $auxKeys = ['supplier', 'date', 'total'];
    $found = 0;
    foreach ($auxKeys as $key) {
      if (! empty($reviewSuggestions[$key])) {
        $found++;
      }
    }

    return min(1.0, $found / 3);
  }

  /**
   * @param  array<string, mixed>  $values
   * @param  array<string, mixed>  $breakdown
   * @param  array<string, mixed>  $reviewSuggestions
   * @return array<string, float>
   */
  private function fieldScores(array $values, array $breakdown, float $dimensionScore, float $receiptPattern, array $reviewSuggestions): array
  {
    $scores = [];
    foreach (['length', 'width', 'height', 'volume'] as $field) {
      if (($values[$field] ?? null) === null) {
        $scores[$field] = 0.0;
      } else {
        $scores[$field] = round(min(0.99, max(0.35, $dimensionScore * 0.9 + 0.1)), 4);
      }
    }

    if (($values['delivery_receipt_number'] ?? null) === null) {
      $scores['delivery_receipt_number'] = 0.0;
    } else {
      $scores['delivery_receipt_number'] = round(min(0.99, max(0.35, $receiptPattern)), 4);
    }

    foreach (['supplier', 'date', 'total'] as $aux) {
      $entries = $reviewSuggestions[$aux] ?? [];
      if (! is_array($entries) || $entries === []) {
        continue;
      }
      $top = $entries[0]['confidence'] ?? 0.55;
      $scores[$aux] = round(min(0.99, max(0.0, (float) $top)), 4);
    }

    return $scores;
  }
}
