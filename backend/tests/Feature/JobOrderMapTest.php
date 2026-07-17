<?php

namespace Tests\Feature;

use App\Models\JobOrder;
use App\Models\Quarry;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class JobOrderMapTest extends TestCase
{
    use RefreshDatabase;

    private User $dispatcher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dispatcher = User::factory()->create([
            'role_id' => Role::create(['name' => 'dispatcher'])->id,
            'email_verified_at' => now(),
        ]);
    }

    public function test_map_endpoint_returns_pickup_and_destination_payload(): void
    {
        $jobOrder = JobOrder::create([
            'created_by' => $this->dispatcher->id,
            'tracking_code' => 'MAPTEST001',
            'customer_name' => 'Map Client',
            'pickup_street' => '123 Main',
            'pickup_city' => 'Manila',
            'pickup_province' => 'Metro Manila',
            'dropoff_street' => '456 Market',
            'dropoff_city' => 'Quezon City',
            'dropoff_province' => 'Metro Manila',
            'pickup_location' => '123 Main, Manila',
            'dropoff_location' => '456 Market, Quezon City',
            'pickup_latitude' => 14.5995,
            'pickup_longitude' => 120.9842,
            'dropoff_latitude' => 14.6760,
            'dropoff_longitude' => 121.0437,
            'status' => 'pending',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $response = $this->apiAs($this->dispatcher)->getJson("/api/job-orders/{$jobOrder->id}/map");

        $response->assertOk()
            ->assertJsonPath('data.job_order_id', $jobOrder->id)
            ->assertJsonPath('data.pickup.lat', 14.5995)
            ->assertJsonPath('data.destination.lat', 14.676)
            ->assertJsonStructure([
                'data' => [
                    'pickup' => ['lat', 'lng', 'address'],
                    'destination' => ['lat', 'lng', 'address'],
                    'route' => ['distance_label', 'duration_label', 'polyline', 'source'],
                    'geocode' => ['pickup_resolved', 'destination_resolved', 'pickup_address', 'destination_address'],
                ],
            ]);
    }

    public function test_map_geocodes_legacy_addresses_when_coordinates_missing(): void
    {
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::sequence()
                ->push([['lat' => '14.5995', 'lon' => '120.9842']])
                ->push([['lat' => '14.6760', 'lon' => '121.0437']]),
        ]);

        $jobOrder = JobOrder::create([
            'created_by' => $this->dispatcher->id,
            'tracking_code' => 'MAPTEST002',
            'customer_name' => 'Legacy Client',
            'pickup_location' => '123 Main, Manila, Metro Manila',
            'dropoff_location' => '456 Market, Quezon City, Metro Manila',
            'status' => 'pending',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $response = $this->apiAs($this->dispatcher)->getJson("/api/job-orders/{$jobOrder->id}/map");

        $response->assertOk()
            ->assertJsonPath('data.geocode.pickup_resolved', true)
            ->assertJsonPath('data.geocode.destination_resolved', true);

        $jobOrder->refresh();
        $this->assertSame(14.5995, (float) $jobOrder->pickup_latitude);
        $this->assertSame(121.0437, (float) $jobOrder->dropoff_longitude);
    }

    public function test_map_resolves_quarry_pickup_when_structured_address_missing(): void
    {
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::sequence()
                ->push([['lat' => '14.5500', 'lon' => '121.0200']])
                ->push([['lat' => '14.6760', 'lon' => '121.0437']]),
        ]);

        $quarry = Quarry::create([
            'quarry_name' => 'North Quarry Site',
            'address' => 'North Quarry Site, Rizal',
            'status' => 'active',
        ]);

        $jobOrder = JobOrder::create([
            'created_by' => $this->dispatcher->id,
            'tracking_code' => 'MAPTEST003',
            'customer_name' => 'Quarry Client',
            'quarry_id' => $quarry->id,
            'dropoff_street' => '456 Market',
            'dropoff_city' => 'Quezon City',
            'dropoff_province' => 'Metro Manila',
            'dropoff_location' => '456 Market, Quezon City',
            'status' => 'pending',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $response = $this->apiAs($this->dispatcher)->getJson("/api/job-orders/{$jobOrder->id}/map");

        $response->assertOk()
            ->assertJsonPath('data.geocode.pickup_address', 'North Quarry Site, Rizal')
            ->assertJsonPath('data.geocode.pickup_resolved', true);
    }

    public function test_map_clears_invalid_zero_coordinates_and_attempts_geocode(): void
    {
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '14.5995', 'lon' => '120.9842'],
            ]),
        ]);

        $jobOrder = JobOrder::create([
            'created_by' => $this->dispatcher->id,
            'tracking_code' => 'MAPTEST004',
            'customer_name' => 'Invalid Coords Client',
            'pickup_location' => '123 Main, Manila',
            'dropoff_location' => '456 Market, Quezon City',
            'pickup_latitude' => 0,
            'pickup_longitude' => 0,
            'dropoff_latitude' => 14.6760,
            'dropoff_longitude' => 121.0437,
            'status' => 'pending',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $response = $this->apiAs($this->dispatcher)->getJson("/api/job-orders/{$jobOrder->id}/map");

        $response->assertOk()
            ->assertJsonPath('data.pickup.lat', 14.5995);

        $jobOrder->refresh();
        $this->assertSame(14.5995, (float) $jobOrder->pickup_latitude);
    }
}
