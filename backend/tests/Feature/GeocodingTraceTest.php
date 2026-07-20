<?php

namespace Tests\Feature;

use App\Models\GeocodingTrace;
use App\Models\Role;
use App\Models\User;
use App\Services\Geocoding\ConfirmedLocationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GeocodingTraceTest extends TestCase
{
    use RefreshDatabase;

    public function test_autocomplete_logs_full_candidates_and_user_confirmation(): void
    {
        config()->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));
        config()->set('gps.geocoding.autocomplete_providers', ['photon']);
        config()->set('gps.geocoding.photon_url', 'https://photon.test/api/');
        Http::fake([
            'https://photon.test/api/*' => Http::response([
                'features' => [
                    [
                        'geometry' => ['coordinates' => [120.9889112, 14.6042837]],
                        'properties' => [
                            'osm_id' => 101,
                            'name' => 'FEU Institute of Technology',
                            'type' => 'amenity',
                            'city' => 'Manila',
                            'state' => 'Metro Manila',
                            'country' => 'Philippines',
                        ],
                    ],
                    [
                        'geometry' => ['coordinates' => [121.0701, 14.6492]],
                        'properties' => [
                            'osm_id' => 102,
                            'name' => 'FEU Diliman',
                            'type' => 'amenity',
                            'city' => 'Quezon City',
                            'state' => 'Metro Manila',
                            'country' => 'Philippines',
                        ],
                    ],
                ],
            ]),
        ]);
        $user = User::factory()->create([
            'role_id' => Role::create(['name' => 'dispatcher'])->id,
            'email_verified_at' => now(),
        ]);

        $search = $this->apiAs($user)->postJson('/api/geocoding/autocomplete', [
            'query' => 'FEU',
            'context' => 'pickup',
            'region' => 'National Capital Region',
            'city' => 'Manila',
            'barangay' => 'Sampaloc',
        ])->assertOk()
            ->assertJsonCount(1, 'data.candidates')
            ->assertJsonPath('data.candidates.0.name', 'FEU Institute of Technology');

        $trace = GeocodingTrace::findOrFail($search->json('data.trace_id'));
        $this->assertSame('FEU', $trace->raw_input);
        $this->assertStringContainsString('Sampaloc', $trace->normalized_address);
        $this->assertCount(2, $trace->candidates);
        $this->assertFalse($trace->candidates[1]['eligible']);
        $this->assertCount(2, $trace->response_payload['selected_provider_response']['features']);
        $this->assertNotEmpty($trace->response_payload['selected_provider_response']);

        $candidate = $search->json('data.candidates.0');
        $confirmed = $this->apiAs($user)->postJson("/api/geocoding/traces/{$trace->id}/confirm", [
            'mode' => 'autocomplete',
            'candidate_id' => $candidate['id'],
            'latitude' => $candidate['lat'],
            'longitude' => $candidate['lng'],
        ])->assertOk()
            ->assertJsonPath('data.latitude', 14.6042837)
            ->assertJsonPath('data.longitude', 120.9889112);

        $token = json_decode(Crypt::decryptString($confirmed->json('data.confirmation_token')), true);
        $this->assertSame($trace->id, $token['trace_id']);
        $this->assertSame('autocomplete_selection', $token['source']);
        $this->assertSame('user_selected_autocomplete_candidate', $trace->fresh()->selection_reason);

        Auth::setUser($user);
        $resolved = app(ConfirmedLocationService::class)->fromPayload([
            'pickup_coordinate_confirmation_token' => $confirmed->json('data.confirmation_token'),
        ], 'pickup', true, 'FEU Institute of Technology');
        $this->assertSame(14.6042837, $resolved['lat']);
        $this->assertSame(120.9889112, $resolved['lng']);

        $this->apiAs($user)->postJson("/api/geocoding/traces/{$trace->id}/rendered", [
            'latitude' => 14.6042837,
            'longitude' => 120.9889112,
        ])->assertNoContent();
        $this->assertSame(14.6042837, $trace->fresh()->rendered_latitude);
    }
}
