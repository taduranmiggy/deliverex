<?php

namespace Tests\Unit;

use App\Services\Ocr\OcrService;
use ReflectionMethod;
use Tests\TestCase;

class OcrServiceParsingTest extends TestCase
{
    private function parse(string $text): array
    {
        $service = app(OcrService::class);
        $method = new ReflectionMethod($service, 'extractStructuredFields');
        $method->setAccessible(true);

        /** @var array{length:?float,width:?float,height:?float,volume:?float,delivery_receipt_number:?string} $result */
        $result = $method->invoke($service, $text);

        return $result;
    }

    public function test_extracts_fields_with_common_ocr_label_noise(): void
    {
        $text = <<<TXT
        De1ivery Receipt No: DR-982134
        1ength: 2,50 m
        w1dth 1.20
        he1ght=0.80
        vo1ume 2.40 cbm
        TXT;

        $parsed = $this->parse($text);

        $this->assertEqualsWithDelta(2.5, (float) $parsed['length'], 0.0001);
        $this->assertEqualsWithDelta(1.2, (float) $parsed['width'], 0.0001);
        $this->assertEqualsWithDelta(0.8, (float) $parsed['height'], 0.0001);
        $this->assertEqualsWithDelta(2.4, (float) $parsed['volume'], 0.0001);
        $this->assertSame('DR-982134', $parsed['delivery_receipt_number']);
    }

    public function test_extracts_inline_dimensions_when_labels_are_missing(): void
    {
        $text = <<<TXT
        RECEIPT AB-441122
        Dimensions: 2.40 x 1.30 x 0.50 m
        TXT;

        $parsed = $this->parse($text);

        $this->assertEqualsWithDelta(2.4, (float) $parsed['length'], 0.0001);
        $this->assertEqualsWithDelta(1.3, (float) $parsed['width'], 0.0001);
        $this->assertEqualsWithDelta(0.5, (float) $parsed['height'], 0.0001);
        $this->assertSame('AB-441122', $parsed['delivery_receipt_number']);
        $this->assertEqualsWithDelta(1.56, (float) $parsed['volume'], 0.0001);
    }

    public function test_extracts_table_style_dimensions_and_dr_suffix(): void
    {
        $text = <<<TXT
        DELIVERY RECEIPT
        DR No: DR - 2936506
        Item Qty Description L (m) W (m) H (m) V (m3)
        1 1 Crushed Aggregate 7.30 2.30 2.15 36.09
        TXT;

        $parsed = $this->parse($text);

        $this->assertEqualsWithDelta(7.30, (float) $parsed['length'], 0.0001);
        $this->assertEqualsWithDelta(2.30, (float) $parsed['width'], 0.0001);
        $this->assertEqualsWithDelta(2.15, (float) $parsed['height'], 0.0001);
        $this->assertEqualsWithDelta(36.09, (float) $parsed['volume'], 0.0001);
        $this->assertSame('DR-2936506', $parsed['delivery_receipt_number']);
    }
}
