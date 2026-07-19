<?php

namespace Tests\Unit;

use App\Services\Address\PsgcClient;
use App\Services\Address\StandardizedAddressService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class PsgcAddressServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
        config()->set('psgc.base_url', 'https://psgc.test/api/v2');
        config()->set('gps.routing.openrouteservice_api_key', null);
    }

    public function test_psgc_lists_are_cached(): void
    {
        Http::fake([
            'https://psgc.test/api/v2/regions' => Http::response([
                ['code' => '0300000000', 'name' => 'Central Luzon'],
            ]),
        ]);

        $client = app(PsgcClient::class);

        $this->assertCount(1, $client->regions());
        $this->assertCount(1, $client->regions());
        Http::assertSentCount(1);
    }

    public function test_hierarchy_rejects_a_province_from_another_region(): void
    {
        Http::fake([
            'https://psgc.test/api/v2/regions' => Http::response([
                ['code' => '0300000000', 'name' => 'Central Luzon'],
            ]),
            'https://psgc.test/api/v2/regions/0300000000/provinces' => Http::response([
                ['code' => '0314000000', 'name' => 'Bulacan'],
            ]),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('does not belong');

        app(PsgcClient::class)->resolveHierarchy(
            '0300000000',
            '0128000000',
            '1374040000',
            '1374040001',
        );
    }

    public function test_psgc_client_sanitizes_mojibake_names_from_api(): void
    {
        Http::fake([
            'https://psgc.test/api/v2/regions' => Http::response([
                ['code' => '1300000000', 'name' => 'Santo NiÃ±o'],
            ]),
        ]);

        $regions = app(PsgcClient::class)->regions();

        $this->assertSame('SANTO NIÑO', $regions[0]['name']);
    }

    public function test_standardized_address_uses_official_names_and_server_geocoding(): void
    {
        Http::fake([
            'https://psgc.test/api/v2/regions' => Http::response([
                ['code' => '0300000000', 'name' => 'Central Luzon'],
            ]),
            'https://psgc.test/api/v2/regions/0300000000/provinces' => Http::response([
                ['code' => '0314000000', 'name' => 'Bulacan'],
            ]),
            'https://psgc.test/api/v2/regions/0300000000/provinces/0314000000/cities-municipalities' => Http::response([
                ['code' => '0314100000', 'name' => 'City of Malolos'],
            ]),
            'https://psgc.test/api/v2/regions/0300000000/provinces/0314000000/cities-municipalities/0314100000/barangays' => Http::response([
                ['code' => '0314100001', 'name' => 'Guinhawa'],
            ]),
            'https://nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '14.8527', 'lon' => '120.8156'],
            ]),
        ]);

        $normalized = app(StandardizedAddressService::class)->normalize([
            'pickup_region_code' => '0300000000',
            'pickup_province_code' => '0314000000',
            'pickup_city_code' => '0314100000',
            'pickup_barangay_code' => '0314100001',
            'pickup_street' => '123 Rizal Avenue',
            // Deliberately forged labels must be ignored.
            'pickup_city' => 'Quezon City',
            'pickup_province' => 'Metro Manila',
        ], 'pickup');

        $this->assertSame('BULACAN', $normalized['pickup_province']);
        $this->assertSame('CITY OF MALOLOS', $normalized['pickup_city']);
        $this->assertSame('GUINHAWA', $normalized['pickup_barangay']);
        $this->assertSame('123 RIZAL AVENUE', $normalized['pickup_street']);
        $this->assertSame(
            '123 RIZAL AVENUE, BARANGAY GUINHAWA, CITY OF MALOLOS, BULACAN, CENTRAL LUZON, PHILIPPINES',
            $normalized['pickup_formatted_address'],
        );
        $this->assertSame(14.8527, $normalized['pickup_latitude']);
        $this->assertSame(120.8156, $normalized['pickup_longitude']);
    }

    public function test_job_order_address_can_save_without_geocode_when_not_required(): void
    {
        Http::fake([
            'https://psgc.test/api/v2/regions' => Http::response([
                ['code' => '0300000000', 'name' => 'Central Luzon'],
            ]),
            'https://psgc.test/api/v2/regions/0300000000/provinces' => Http::response([
                ['code' => '0314000000', 'name' => 'Bulacan'],
            ]),
            'https://psgc.test/api/v2/regions/0300000000/provinces/0314000000/cities-municipalities' => Http::response([
                ['code' => '0314100000', 'name' => 'City of Malolos'],
            ]),
            'https://psgc.test/api/v2/regions/0300000000/provinces/0314000000/cities-municipalities/0314100000/barangays' => Http::response([
                ['code' => '0314100001', 'name' => 'Guinhawa'],
            ]),
            'https://nominatim.openstreetmap.org/*' => Http::response([]),
        ]);

        $normalized = app(StandardizedAddressService::class)->normalize([
            'pickup_region_code' => '0300000000',
            'pickup_province_code' => '0314000000',
            'pickup_city_code' => '0314100000',
            'pickup_barangay_code' => '0314100001',
            'pickup_street' => '123 Rizal Avenue',
        ], 'pickup', false);

        $this->assertNull($normalized['pickup_latitude']);
        $this->assertNull($normalized['pickup_longitude']);
        $this->assertNull($normalized['pickup_geocode_attempted_at']);
        $this->assertSame('123 RIZAL AVENUE', $normalized['pickup_street']);
    }
}
