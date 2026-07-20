<?php

namespace Tests\Unit;

use App\Services\Gps\RouteDirectionsService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RouteDirectionsCoordinateOrderTest extends TestCase
{
    public function test_routing_uses_geojson_order_and_returns_leaflet_order(): void
    {
        config()->set('gps.routing.openrouteservice_api_key', 'test-key');
        config()->set('gps.routing.openrouteservice_url', 'https://ors.test/directions');
        Http::fake([
            'https://ors.test/directions' => function (Request $request) {
                $this->assertSame([
                    [120.9846219, 14.5996214],
                    [121.0437123, 14.6760456],
                ], $request->data()['coordinates']);

                return Http::response([
                    'features' => [[
                        'geometry' => ['coordinates' => [
                            [120.9847000, 14.5997000],
                            [121.0436000, 14.6760000],
                        ]],
                        'properties' => ['summary' => ['distance' => 12000, 'duration' => 1800]],
                    ]],
                ]);
            },
        ]);

        $route = app(RouteDirectionsService::class)->route(
            14.5996214,
            120.9846219,
            14.6760456,
            121.0437123,
        );

        $this->assertSame('openrouteservice', $route['source']);
        $this->assertSame([14.5996214, 120.9846219], $route['polyline'][0]);
        $this->assertSame([14.6760456, 121.0437123], $route['polyline'][3]);
    }
}
