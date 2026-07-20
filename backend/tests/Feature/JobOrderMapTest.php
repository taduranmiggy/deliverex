<?php

namespace Tests\Feature;

use App\Models\JobOrder;
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

    public function test_map_returns_the_exact_persisted_coordinate_pair_without_geocoding(): void
    {
        Http::fake();
        $jobOrder = $this->jobOrder([
            'pickup_latitude' => 14.6042837,
            'pickup_longitude' => 120.9889112,
            'dropoff_latitude' => 14.5996214,
            'dropoff_longitude' => 120.9846219,
        ]);

        $response = $this->apiAs($this->dispatcher)->getJson("/api/job-orders/{$jobOrder->id}/map");

        $response->assertOk()
            ->assertJsonPath('data.pickup.lat', 14.6042837)
            ->assertJsonPath('data.pickup.lng', 120.9889112)
            ->assertJsonPath('data.destination.lat', 14.5996214)
            ->assertJsonPath('data.destination.lng', 120.9846219);
        $this->assertNoGeocoderRequestWasSent();

        $jobOrder->refresh();
        $this->assertSame(14.6042837, $jobOrder->pickup_latitude);
        $this->assertSame(120.9846219, $jobOrder->dropoff_longitude);
    }

    public function test_map_with_missing_coordinates_is_read_only_and_never_geocodes_text(): void
    {
        Http::fake();
        $jobOrder = $this->jobOrder();

        $response = $this->apiAs($this->dispatcher)->getJson("/api/job-orders/{$jobOrder->id}/map");

        $response->assertOk()
            ->assertJsonPath('data.pickup', null)
            ->assertJsonPath('data.destination', null)
            ->assertJsonPath('data.geocode.pickup_resolved', false)
            ->assertJsonPath('data.geocode.destination_resolved', false);
        Http::assertNothingSent();
        $this->assertNull($jobOrder->fresh()->pickup_latitude);
        $this->assertNull($jobOrder->fresh()->dropoff_longitude);
    }

    public function test_tracking_read_does_not_generate_or_replace_job_coordinates(): void
    {
        Http::fake();
        $jobOrder = $this->jobOrder([
            'pickup_latitude' => 14.6042837,
            'pickup_longitude' => 120.9889112,
            'dropoff_latitude' => 14.5996214,
            'dropoff_longitude' => 120.9846219,
        ]);

        $response = $this->apiAs($this->dispatcher)->getJson("/api/job-orders/{$jobOrder->id}/tracking");

        $response->assertOk()
            ->assertJsonPath('data.pickup.lat', 14.6042837)
            ->assertJsonPath('data.destination.lng', 120.9846219);
        $jobOrder->refresh();
        $this->assertSame(14.6042837, $jobOrder->pickup_latitude);
        $this->assertSame(120.9846219, $jobOrder->dropoff_longitude);
        $this->assertNoGeocoderRequestWasSent();
    }

    private function jobOrder(array $overrides = []): JobOrder
    {
        return JobOrder::create(array_merge([
            'created_by' => $this->dispatcher->id,
            'tracking_code' => 'MAP'.strtoupper(substr(md5((string) microtime(true)), 0, 7)),
            'customer_name' => 'Map Client',
            'pickup_street' => 'FEU Institute of Technology',
            'pickup_city' => 'Manila',
            'pickup_province' => 'Metro Manila',
            'pickup_location' => 'FEU Institute of Technology, Manila',
            'dropoff_street' => 'Manila City Hall',
            'dropoff_city' => 'Manila',
            'dropoff_province' => 'Metro Manila',
            'dropoff_location' => 'Manila City Hall, Manila',
            'status' => 'pending',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ], $overrides));
    }

    private function assertNoGeocoderRequestWasSent(): void
    {
        Http::assertNotSent(static function ($request): bool {
            $url = $request->url();

            return str_contains($url, 'maps.googleapis.com/maps/api/geocode')
                || str_contains($url, 'maps.googleapis.com/maps/api/place');
        });
    }
}
