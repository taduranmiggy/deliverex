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
}
