<?php

namespace Tests\Unit;

use App\Services\Ocr\OcrService;
use ReflectionMethod;
use Tests\TestCase;

class OcrServiceParsingTest extends TestCase
{
    private function parse(string $text): array
    {
        return $this->parseWithHints($text, []);
    }

    /**
     * @param  array<string, mixed>  $hints
     * @return array{length:?float,width:?float,height:?float,volume:?float,delivery_receipt_number:?string}
     */
    private function parseWithHints(string $text, array $hints = []): array
    {
        $service = app(OcrService::class);
        $method = new ReflectionMethod($service, 'extractStructuredFieldsWithDebug');
        $method->setAccessible(true);

        /** @var array{values:array{length:?float,width:?float,height:?float,volume:?float,delivery_receipt_number:?string}} $result */
        $result = $method->invoke($service, $text, $hints);

        return $result['values'];
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

        $this->assertEqualsWithDelta(250, (float) $parsed['length'], 0.0001);
        $this->assertEqualsWithDelta(120, (float) $parsed['width'], 0.0001);
        $this->assertEqualsWithDelta(80, (float) $parsed['height'], 0.0001);
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

        $this->assertEqualsWithDelta(240, (float) $parsed['length'], 0.0001);
        $this->assertEqualsWithDelta(130, (float) $parsed['width'], 0.0001);
        $this->assertEqualsWithDelta(50, (float) $parsed['height'], 0.0001);
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

        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.0001);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.0001);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.0001);
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
        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
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
        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
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
        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
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

    public function test_extracts_dimensions_from_l_w_h_shorthand_labels(): void
    {
        $text = <<<TXT
        Vendor: North Aggregates
        Invoice Date: 2026-06-27
        L : 730
        W : 230
        H : 215
        Receipt No: 2936807
        TXT;

        $parsed = $this->parse($text);

        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
        $this->assertEqualsWithDelta(36.0985, (float) $parsed['volume'], 0.01);
        $this->assertSame('DR-2936807', $parsed['delivery_receipt_number']);
    }

    public function test_extracts_dimensions_from_inline_dimension_heading_with_multiplication_symbol(): void
    {
        $text = <<<TXT
        Supplier: Providential
        Dimensions
        730 × 230 × 215
        Delivery No: DR-2936808
        TXT;

        $parsed = $this->parse($text);

        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
        $this->assertEqualsWithDelta(36.09, (float) $parsed['volume'], 0.01);
        $this->assertSame('DR-2936808', $parsed['delivery_receipt_number']);
    }

    public function test_parser_accepts_structured_hints_with_table_lines(): void
    {
        $text = <<<TXT
        DELIVERY RECEIPT
        Supplier: Providential
        TXT;

        $hints = [
            'table_lines' => [
                'Item Qty Description L (cm) W (cm) H (cm) V (m3)',
                '1 1 Crushed Aggregate 730 230 215 36.09',
            ],
            'entity_mentions' => ['DR-2936810'],
        ];

        $parsed = $this->parseWithHints($text, $hints);

        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
        $this->assertEqualsWithDelta(36.09, (float) $parsed['volume'], 0.01);
        $this->assertSame('DR-2936810', $parsed['delivery_receipt_number']);
    }

    public function test_neighbor_label_extraction_reads_value_from_next_line(): void
    {
        $text = <<<TXT
        ticket no
        2936811
        length
        7.30
        width
        2.30
        height
        2.15
        TXT;

        $parsed = $this->parseWithHints($text, []);

        $this->assertSame('DR-2936811', $parsed['delivery_receipt_number']);
        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
    }

    public function test_per_field_merge_fills_missing_dimension_from_alternate_candidate(): void
    {
        $text = <<<TXT
        DELIVERY RECEIPT DR-5551234
        length: 730
        width: 230
        height: 215
        reference batch 829 lane 1
        TXT;

        $parsed = $this->parse($text);

        $this->assertEqualsWithDelta(730, (float) $parsed['length'], 0.01);
        $this->assertEqualsWithDelta(230, (float) $parsed['width'], 0.01);
        $this->assertEqualsWithDelta(215, (float) $parsed['height'], 0.01);
        $this->assertSame('DR-5551234', $parsed['delivery_receipt_number']);
    }

    public function test_extracts_auxiliary_truck_and_driver_fields(): void
    {
        $service = app(\App\Services\Ocr\OcrService::class);
        $method = new ReflectionMethod($service, 'extractStructuredFieldsWithDebug');
        $method->setAccessible(true);

        $text = <<<TXT
        truck no: ABC 1234
        driver name: Pedro Santos
        customer: CRBC Site A
        material: Crushed Aggregate
        delivery date: 2026-06-27
        length: 730
        width: 230
        height: 215
        dr no: 8887776
        TXT;

        /** @var array{auxiliary:array<string,?string>} $result */
        $result = $method->invoke($service, $text, []);

        $this->assertStringContainsString('abc', strtolower((string) ($result['auxiliary']['vehicle_plate'] ?? '')));
        $this->assertStringContainsString('pedro', strtolower((string) ($result['auxiliary']['driver_name'] ?? '')));
        $this->assertStringContainsString('crbc', strtolower((string) ($result['auxiliary']['customer'] ?? '')));
    }
}
