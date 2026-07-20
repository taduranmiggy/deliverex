<?php

namespace Tests\Unit;

use App\Support\GeocodeAnchor;
use App\Support\GeocodeResultScorer;
use Tests\TestCase;

class GeocodeResultScorerTest extends TestCase
{
    private GeocodeResultScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scorer = new GeocodeResultScorer;
    }

    public function test_rejects_coordinates_far_from_anchor_city(): void
    {
        $anchor = new GeocodeAnchor(city: 'RODRIGUEZ', province: 'RIZAL');
        $centroid = ['lat' => 14.76, 'lng' => 121.20];
        $wrongCoords = ['lat' => 17.15, 'lng' => 121.88];

        $this->assertFalse($this->scorer->accepts(
            $anchor,
            $wrongCoords,
            ['Ilagan', 'Isabela'],
            $centroid,
        ));
    }

    public function test_accepts_coordinates_near_anchor_city(): void
    {
        $anchor = new GeocodeAnchor(city: 'RODRIGUEZ', province: 'RIZAL');
        $centroid = ['lat' => 14.76, 'lng' => 121.20];
        $nearCoords = ['lat' => 14.74, 'lng' => 121.19];

        $this->assertTrue($this->scorer->accepts(
            $anchor,
            $nearCoords,
            ['Rodriguez', 'Rizal'],
            $centroid,
        ));
    }

    public function test_rejects_ncr_destination_in_rizal(): void
    {
        $anchor = new GeocodeAnchor(
            city: 'SAMPALOC',
            region: 'NATIONAL CAPITAL REGION (NCR)',
            barangay: '396',
        );
        $centroid = ['lat' => 14.604, 'lng' => 120.989];
        $tanayCoords = ['lat' => 14.498, 'lng' => 121.364];

        $this->assertFalse($this->scorer->storedCoordinatesMatch($anchor, $tanayCoords, $centroid));
        $this->assertFalse($this->scorer->accepts(
            $anchor,
            $tanayCoords,
            ['Tanay', 'Rizal'],
            $centroid,
        ));
    }

    public function test_accepts_quezon_city_for_ncr_anchor(): void
    {
        $anchor = new GeocodeAnchor(
            city: 'QUEZON CITY',
            province: 'METRO MANILA',
            region: 'NATIONAL CAPITAL REGION (NCR)',
        );
        $centroid = ['lat' => 14.676, 'lng' => 121.0437];
        $coords = ['lat' => 14.670, 'lng' => 121.040];

        $this->assertFalse($this->scorer->conflictsWithAnchor($anchor, ['Quezon City', 'Metro Manila']));
        $this->assertTrue($this->scorer->accepts(
            $anchor,
            $coords,
            ['Quezon City', 'Metro Manila'],
            $centroid,
        ));
    }
}
