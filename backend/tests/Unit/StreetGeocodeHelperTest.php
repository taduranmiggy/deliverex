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

    public function test_expected_street_tokens_extracts_paredes(): void
    {
        $tokens = StreetGeocodeHelper::expectedStreetTokens(
            '865 P. Paredes St., Barangay 410, Sampaloc, Manila, Philippines',
        );

        $this->assertContains('paredes', $tokens);
    }

    public function test_query_looks_like_street_address(): void
    {
        $this->assertTrue(StreetGeocodeHelper::queryLooksLikeStreetAddress('865 P. Paredes St., Sampaloc, Manila'));
        $this->assertFalse(StreetGeocodeHelper::queryLooksLikeStreetAddress('Quezon City, Philippines'));
    }

    public function test_result_conflicts_with_query_rejects_pares_for_paredes(): void
    {
        $this->assertTrue(StreetGeocodeHelper::resultConflictsWithQuery(
            '865 P. Paredes St., Barangay 410, Sampaloc, Manila, Philippines',
            ['Pares Street', 'Sampaloc, Manila, Metro Manila, Philippines'],
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
}
