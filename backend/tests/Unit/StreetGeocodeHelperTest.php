<?php

namespace Tests\Unit;

use App\Support\StreetGeocodeHelper;
use Tests\TestCase;

class StreetGeocodeHelperTest extends TestCase
{
    public function test_expand_for_geocode_expands_p_initial_streets(): void
    {
        $this->assertSame('865 Paredes Street', StreetGeocodeHelper::expandForGeocode('865 P. Paredes St.'));
        $this->assertSame('9009 Rodriguez Street', StreetGeocodeHelper::expandForGeocode('9009 P. Rodriguez St.'));
    }

    public function test_expand_for_geocode_expands_compact_p_prefix_without_space(): void
    {
        $this->assertSame('PAREDES Street', StreetGeocodeHelper::expandForGeocode('P.PAREDES STREET'));
        $this->assertSame('865 PAREDES Street', StreetGeocodeHelper::expandForGeocode('865 P.PAREDES ST.'));
    }

    public function test_expected_street_tokens_extracts_paredes(): void
    {
        $tokens = StreetGeocodeHelper::expectedStreetTokens(
            '865 P. Paredes St., Barangay 410, Sampaloc, Manila, Philippines',
        );

        $this->assertContains('paredes', $tokens);
    }

    public function test_expected_street_tokens_extracts_paredes_from_compact_prefix(): void
    {
        $tokens = StreetGeocodeHelper::expectedStreetTokens(
            'P.PAREDES STREET, Barangay 395, Sampaloc, Manila, Philippines',
        );

        $this->assertContains('paredes', $tokens);
    }

    public function test_query_looks_like_street_address(): void
    {
        $this->assertTrue(StreetGeocodeHelper::queryLooksLikeStreetAddress('865 P. Paredes St., Sampaloc, Manila'));
        $this->assertTrue(StreetGeocodeHelper::queryLooksLikeStreetAddress('P.PAREDES STREET, Sampaloc, Manila'));
        $this->assertFalse(StreetGeocodeHelper::queryLooksLikeStreetAddress('Quezon City, Philippines'));
    }

    public function test_result_conflicts_with_query_rejects_pares_for_paredes(): void
    {
        $this->assertTrue(StreetGeocodeHelper::resultConflictsWithQuery(
            '865 P. Paredes St., Barangay 410, Sampaloc, Manila, Philippines',
            ['Pares Street', 'Sampaloc, Manila, Metro Manila, Philippines'],
        ));
    }

    public function test_result_conflicts_with_query_rejects_blumentritt_for_paredes(): void
    {
        $this->assertTrue(StreetGeocodeHelper::resultConflictsWithQuery(
            'P.PAREDES STREET, Barangay 395, Sampaloc, Manila, Philippines',
            ['Blumentritt Road', 'Sampaloc, Manila, Metro Manila, Philippines'],
        ));
    }

    public function test_result_conflicts_with_query_accepts_matching_paredes(): void
    {
        $this->assertFalse(StreetGeocodeHelper::resultConflictsWithQuery(
            '865 P. Paredes St., Barangay 410, Sampaloc, Manila, Philippines',
            ['Paredes Street', 'Sampaloc, Manila, Metro Manila, Philippines'],
        ));
    }

    public function test_geocode_street_variants_include_expanded_form(): void
    {
        $variants = StreetGeocodeHelper::geocodeStreetVariants('865 P. Paredes St.');

        $this->assertContains('865 P. Paredes St.', $variants);
        $this->assertContains('865 Paredes Street', $variants);
    }

    public function test_geocode_street_variants_include_compact_p_prefix_expansion(): void
    {
        $variants = StreetGeocodeHelper::geocodeStreetVariants('P.PAREDES STREET');

        $this->assertContains('P.PAREDES STREET', $variants);
        $this->assertContains('PAREDES Street', $variants);
    }

    public function test_needs_street_reconcile_for_compact_p_prefix(): void
    {
        $this->assertTrue(StreetGeocodeHelper::needsStreetReconcile('P.PAREDES STREET'));
        $this->assertTrue(StreetGeocodeHelper::needsStreetReconcile('865 P. Paredes St.'));
        $this->assertFalse(StreetGeocodeHelper::needsStreetReconcile('123 Main Street'));
    }
}
