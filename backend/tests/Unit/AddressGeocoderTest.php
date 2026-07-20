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
        config()->set('gps.geocoding.google_maps_api_key', 'test-google-key');
    }

    public function test_geocode_uses_google_geocoding_api(): void
    {
        Http::fake([
            'https://maps.googleapis.com/maps/api/geocode/json*' => Http::response([
                'status' => 'OK',
                'results' => [[
                    'place_id' => 'ChIJ_quezon',
                    'formatted_address' => 'Quezon City, Metro Manila, Philippines',
                    'geometry' => ['location' => ['lat' => 14.6760, 'lng' => 121.0437]],
                    'address_components' => [
                        ['long_name' => 'Quezon City', 'types' => ['locality']],
                        ['long_name' => 'Metro Manila', 'types' => ['administrative_area_level_1']],
                    ],
                ]],
            ]),
        ]);

        $coords = app(AddressGeocoder::class)->geocode('Quezon City, Philippines');

        $this->assertSame(14.676, $coords['lat']);
        $this->assertSame(121.0437, $coords['lng']);
        $this->assertSame('ChIJ_quezon', $coords['place_id']);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'maps.googleapis.com/maps/api/geocode/json'));
    }

    public function test_geocode_first_tries_multiple_candidates(): void
    {
        Http::fake([
            'https://maps.googleapis.com/maps/api/geocode/json*' => function ($request) {
                $address = $request->data()['address'] ?? '';
                if (str_contains($address, 'Unknown Street')) {
                    return Http::response(['status' => 'ZERO_RESULTS', 'results' => []]);
                }

                return Http::response([
                    'status' => 'OK',
                    'results' => [[
                        'place_id' => 'ChIJ_qc',
                        'formatted_address' => 'Quezon City, Metro Manila, Philippines',
                        'geometry' => ['location' => ['lat' => 14.6760, 'lng' => 121.0437]],
                        'address_components' => [
                            ['long_name' => 'Quezon City', 'types' => ['locality']],
                        ],
                    ]],
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

    public function test_geocode_rejects_pares_street_when_query_is_p_paredes(): void
    {
        Http::fake([
            'https://maps.googleapis.com/maps/api/geocode/json*' => function ($request) {
                $address = strtoupper($request->data()['address'] ?? '');

                if (str_contains($address, 'PARES')) {
                    return Http::response([
                        'status' => 'OK',
                        'results' => [[
                            'place_id' => 'ChIJ_pares',
                            'formatted_address' => 'Pares Street, Manila, Philippines',
                            'geometry' => ['location' => ['lat' => 14.602, 'lng' => 120.991]],
                            'address_components' => [
                                ['long_name' => 'Pares Street', 'types' => ['route']],
                                ['long_name' => 'Manila', 'types' => ['locality']],
                            ],
                        ]],
                    ]);
                }

                if (str_contains($address, 'PAREDES')) {
                    return Http::response([
                        'status' => 'OK',
                        'results' => [[
                            'place_id' => 'ChIJ_paredes',
                            'formatted_address' => 'Paredes Street, Sampaloc, Manila, Philippines',
                            'geometry' => ['location' => ['lat' => 14.604, 'lng' => 120.989]],
                            'address_components' => [
                                ['long_name' => 'Paredes Street', 'types' => ['route']],
                                ['long_name' => 'Manila', 'types' => ['locality']],
                            ],
                        ]],
                    ]);
                }

                return Http::response(['status' => 'ZERO_RESULTS', 'results' => []]);
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
