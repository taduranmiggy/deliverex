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
}
