<?php

namespace Tests\Feature;

use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
                    'route' => ['distance_label', 'duration_label', 'polyline'],
                ],
            ]);
    }
}
