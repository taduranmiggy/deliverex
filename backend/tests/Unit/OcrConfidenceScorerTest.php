<?php

namespace Tests\Unit;

use App\Services\Ocr\OcrConfidenceScorer;
use Tests\TestCase;

class OcrConfidenceScorerTest extends TestCase
{
    private OcrConfidenceScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scorer = new OcrConfidenceScorer;
    }

    public function test_empty_text_returns_minimum_score(): void
    {
        $result = $this->scorer->compute('', [], $this->parsed([]));

        $this->assertEqualsWithDelta(0.05, $result['final'], 0.001);
    }

    public function test_high_provider_and_complete_fields_scores_high(): void
    {
        $parsed = $this->parsed([
            'length' => 7.3,
            'width' => 2.3,
            'height' => 2.15,
            'volume' => 36.09,
            'delivery_receipt_number' => 'DR-2936806',
        ], parserScore: 5.8, receiptConfidence: 0.95);

        $result = $this->scorer->compute(
            str_repeat("delivery receipt line\n", 12),
            ['entity_confidence_avg' => 0.9, 'tables_count' => 1],
            $parsed
        );

        $this->assertGreaterThanOrEqual(0.88, $result['final']);
        $this->assertSame('weighted-v1', $result['confidence_model']['version']);
    }

    public function test_medium_text_without_fields_scores_below_old_heuristic(): void
    {
        $text = str_repeat('abcdefghijklmnopqrstuvwxyz0123456789 ', 3);
        $result = $this->scorer->compute($text, [], $this->parsed([]));

        $this->assertLessThan(0.80, $result['final']);
        $this->assertNotEquals(0.75, $result['final']);
    }

    public function test_low_provider_partial_parse_scores_below_review_threshold(): void
    {
        $parsed = $this->parsed([
            'length' => 2.5,
            'width' => null,
            'height' => null,
            'volume' => null,
            'delivery_receipt_number' => null,
        ], parserScore: 2.0, receiptConfidence: 0.0);

        $result = $this->scorer->compute(
            "length: 2.5\npartial slip",
            ['entity_confidence_avg' => 0.35],
            $parsed
        );

        $this->assertLessThan(0.65, $result['final']);
    }

    public function test_score_not_derived_from_length_buckets_only(): void
    {
        $short = str_repeat('x', 60);
        $long = str_repeat('x', 220);

        $shortResult = $this->scorer->compute($short, [], $this->parsed([]));
        $longResult = $this->scorer->compute($long, [], $this->parsed([]));

        $this->assertNotEquals(0.75, $shortResult['final']);
        $this->assertNotEquals(0.88, $longResult['final']);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function parsed(array $values, float $parserScore = 0.0, float $receiptConfidence = 0.0): array
    {
        return [
            'values' => array_merge([
                'length' => null,
                'width' => null,
                'height' => null,
                'volume' => null,
                'delivery_receipt_number' => null,
            ], $values),
            'matches' => [
                'parser_score' => $parserScore,
                'parser_source' => 'structured_tabular',
            ],
            'meta' => [
                'confidence_breakdown' => [
                    'dimension' => $parserScore,
                    'delivery_receipt_number' => $receiptConfidence,
                ],
                'review_suggestions' => [
                    'supplier' => [['value' => 'Acme Quarry', 'confidence' => 0.7]],
                    'date' => [['value' => '2026-01-15', 'confidence' => 0.7]],
                    'total' => [['value' => '1200', 'confidence' => 0.7]],
                ],
            ],
        ];
    }
}
