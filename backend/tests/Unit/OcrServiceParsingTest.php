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

    public function test_extracts_providential_cm_table_and_dr_number(): void
    {
        $text = <<<TXT
        DELIVERY RECEIPT
        DR No. DR-2936806
        Item Qty Description L (cm) W (cm) H (cm) V (m3)
        1 1 Crushed Aggregate 730 230 215 36.09
        Truck No. ABC 1234
        Length: 7.30 m Width: 2.10 m Height: 2.15 m Volume: 36.09 m3
        TXT;

        $parsed = $this->parse($text);

        $this->assertSame('DR-2936806', $parsed['delivery_receipt_number']);
        $this->assertEqualsWithDelta(7.30, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(2.30, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(2.15, (float) $parsed['height'], 0.01);
        $this->assertEqualsWithDelta(36.09, (float) $parsed['volume'], 0.01);
    }

    public function test_extracts_delivery_receipt_no_without_dr_prefix(): void
    {
        $text = <<<TXT
        DELIVERY RECEIPT
        NO: 2936806
        Item Qty Description L (cm) W (cm) H (cm) V (m3)
        1 1 Crushed Aggregate 730 230 215 36.09
        TXT;

        $parsed = $this->parse($text);

        $this->assertSame('DR-2936806', $parsed['delivery_receipt_number']);
    }

    public function test_rejects_random_numbers_that_only_multiply_to_volume(): void
    {
        $text = <<<TXT
        DELIVERY RECEIPT DR-2936806
        reference S210185 batch 829 lane 1 row 9 total 7461
        730 230 215 36.09
        TXT;

        $parsed = $this->parse($text);

        $this->assertSame('DR-2936806', $parsed['delivery_receipt_number']);
        $this->assertEqualsWithDelta(7.30, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(2.30, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(2.15, (float) $parsed['height'], 0.01);
        $this->assertEqualsWithDelta(36.09, (float) $parsed['volume'], 0.01);
    }

    public function test_extracts_no_serial_on_handwritten_slip_without_delivery_receipt_header(): void
    {
        $text = <<<TXT
        SOLD TO CRBC
        ADDRESS
        DATE
        L = 730
        W = 230
        H = 215
        V = 36.09
        NO: 2936806
        TXT;

        $parsed = $this->parse($text);

        $this->assertSame('DR-2936806', $parsed['delivery_receipt_number']);
        $this->assertEqualsWithDelta(7.30, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(2.30, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(2.15, (float) $parsed['height'], 0.01);
        $this->assertEqualsWithDelta(36.09, (float) $parsed['volume'], 0.01);
    }

    public function test_extracts_trailing_serial_when_no_label_present(): void
    {
        $text = <<<TXT
        SOLD TO CRBC
        730 230 215 36.09
        2936806
        TXT;

        $parsed = $this->parse($text);

        $this->assertSame('DR-2936806', $parsed['delivery_receipt_number']);
    }
}
