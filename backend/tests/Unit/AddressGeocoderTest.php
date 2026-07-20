<?php

namespace Tests\Unit;

use App\Services\Delivery\AddressGeocoder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AddressGeocoderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
    }

    public function test_geocode_prefers_openrouteservice_when_api_key_is_configured(): void
    {
        config()->set('gps.routing.openrouteservice_api_key', 'test-ors-key');

        Http::fake([
            'https://api.openrouteservice.org/geocode/search*' => Http::response([
                'features' => [[
                    'geometry' => ['coordinates' => [121.0437, 14.6760]],
                    'properties' => [
                        'name' => 'Quezon City',
                        'locality' => 'Quezon City',
                        'region' => 'Metro Manila',
                    ],
                ]],
            ]),
            'https://nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '0.0', 'lon' => '0.0'],
            ]),
        ]);

        $coords = app(AddressGeocoder::class)->geocode('Quezon City, Philippines');

        $this->assertSame(14.676, $coords['lat']);
        $this->assertSame(121.0437, $coords['lng']);
        Http::assertSent(function ($request) {
            return $request->hasHeader('Authorization', 'Bearer test-ors-key');
        });
    }

    public function test_geocode_falls_back_to_nominatim_when_openrouteservice_is_unconfigured(): void
    {
        config()->set('gps.routing.openrouteservice_api_key', null);

        Http::fake([
            'https://nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '14.8527', 'lon' => '120.8156'],
            ]),
        ]);

        $coords = app(AddressGeocoder::class)->geocode('City of Malolos, Philippines');

        $this->assertSame(14.8527, $coords['lat']);
        $this->assertSame(120.8156, $coords['lng']);
    }

    public function test_geocode_first_tries_multiple_candidates(): void
    {
        config()->set('gps.routing.openrouteservice_api_key', null);

        Http::fake([
            'https://nominatim.openstreetmap.org/*' => function ($request) {
                $query = $request->data()['q'] ?? '';
                if (str_contains($query, 'Unknown Street')) {
                    return Http::response([]);
                }

                return Http::response([
                    ['lat' => '14.6760', 'lon' => '121.0437'],
                ]);
            },
        ]);

        $coords = app(AddressGeocoder::class)->geocodeFirst([
            'Unknown Street, Quezon City, Philippines',
            'Quezon City, Philippines',
        ]);

        $this->assertSame(14.676, $coords['lat']);
        $this->assertSame(121.0437, $coords['lng']);
        Http::assertSentCount(2);
    }

    public function test_geocode_rejects_mismatched_anchor_and_tries_next_candidate(): void
    {
        config()->set('gps.routing.openrouteservice_api_key', 'test-ors-key');

        Http::fake([
            'https://api.openrouteservice.org/geocode/search*' => function ($request) {
                $text = strtoupper($request->data()['text'] ?? '');

                if (str_contains($text, 'RODRIGUEZ') && str_contains($text, 'RIZAL') && ! str_contains($text, '9009')) {
                    return Http::response([
                        'features' => [[
                            'geometry' => ['coordinates' => [121.20, 14.76]],
                            'properties' => ['name' => 'Rodriguez', 'county' => 'Rizal'],
                        ]],
                    ]);
                }

                if (str_contains($text, '9009')) {
                    return Http::response([
                        'features' => [[
                            'geometry' => ['coordinates' => [121.88, 17.15]],
                            'properties' => ['name' => 'P. Rodriguez', 'county' => 'Isabela'],
                        ]],
                    ]);
                }

                return Http::response(['features' => []]);
            },
        ]);

        $coords = app(AddressGeocoder::class)->geocodeFirst(
            [
                '9009 P. Rodriguez St., Barangay San Rafael, Rodriguez, Rizal, Philippines',
                'Rodriguez, Rizal, Philippines',
            ],
            ['city' => 'RODRIGUEZ', 'province' => 'RIZAL'],
        );

        $this->assertSame(14.76, $coords['lat']);
        $this->assertSame(121.20, $coords['lng']);
    }

    public function test_geocode_rejects_pares_street_when_query_is_p_paredes(): void
    {
        config()->set('gps.routing.openrouteservice_api_key', 'test-ors-key');

        Http::fake([
            'https://api.openrouteservice.org/geocode/search*' => function ($request) {
                $text = strtoupper($request->data()['text'] ?? '');

                if (str_contains($text, 'PARES')) {
                    return Http::response([
                        'features' => [[
                            'geometry' => ['coordinates' => [120.991, 14.602]],
                            'properties' => ['name' => 'Pares Street', 'street' => 'Pares Street', 'locality' => 'Manila'],
                        ]],
                    ]);
                }

                if (str_contains($text, 'PAREDES')) {
                    return Http::response([
                        'features' => [[
                            'geometry' => ['coordinates' => [120.989, 14.604]],
                            'properties' => ['name' => 'Paredes Street', 'street' => 'Paredes Street', 'locality' => 'Manila'],
                        ]],
                    ]);
                }

                return Http::response(['features' => []]);
            },
        ]);

        $coords = app(AddressGeocoder::class)->geocodeFirst(
            [
                '865 P. Paredes St., Barangay 410, Sampaloc, Manila, Philippines',
                '865 Paredes Street, Barangay 410, Sampaloc, Manila, Philippines',
            ],
            [
                'city' => 'SAMPALOC',
                'region' => 'NATIONAL CAPITAL REGION (NCR)',
                'region_code' => '1300000000',
                'barangay' => '410',
            ],
        );

        $this->assertSame(14.604, $coords['lat']);
        $this->assertSame(120.989, $coords['lng']);
    }
}
