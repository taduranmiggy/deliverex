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

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('gps.geocoding.google_maps_api_key', 'test-google-key');
    }

    public function test_autocomplete_logs_full_candidates_and_user_confirmation(): void
    {
        config()->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));
        Http::fake([
            'https://maps.googleapis.com/maps/api/place/autocomplete/json*' => Http::response([
                'status' => 'OK',
                'predictions' => [
                    [
                        'place_id' => 'ChIJ_FEU',
                        'description' => 'FEU Institute of Technology, Sampaloc, Manila, Philippines',
                        'structured_formatting' => [
                            'main_text' => 'FEU Institute of Technology',
                            'secondary_text' => 'Sampaloc, Manila, Philippines',
                            'main_text_matched_substrings' => [['offset' => 0, 'length' => 3]],
                        ],
                    ],
                    [
                        'place_id' => 'ChIJ_FEU_QC',
                        'description' => 'FEU Diliman, Quezon City, Philippines',
                        'structured_formatting' => [
                            'main_text' => 'FEU Diliman',
                            'secondary_text' => 'Quezon City, Philippines',
                        ],
                    ],
                ],
            ]),
            'https://maps.googleapis.com/maps/api/place/details/json*' => function ($request) {
                $placeId = $request->data()['place_id'] ?? '';

                return match ($placeId) {
                    'ChIJ_FEU' => Http::response([
                        'status' => 'OK',
                        'result' => [
                            'place_id' => 'ChIJ_FEU',
                            'name' => 'FEU Institute of Technology',
                            'formatted_address' => 'FEU Institute of Technology, Nicanor Reyes St, Sampaloc, Manila, Philippines',
                            'geometry' => ['location' => ['lat' => 14.6042837, 'lng' => 120.9889112]],
                            'types' => ['establishment', 'point_of_interest'],
                            'address_components' => [
                                ['long_name' => 'Manila', 'types' => ['locality']],
                                ['long_name' => 'Metro Manila', 'types' => ['administrative_area_level_1']],
                            ],
                        ],
                    ]),
                    'ChIJ_FEU_QC' => Http::response([
                        'status' => 'OK',
                        'result' => [
                            'place_id' => 'ChIJ_FEU_QC',
                            'name' => 'FEU Diliman',
                            'formatted_address' => 'FEU Diliman, Quezon City, Philippines',
                            'geometry' => ['location' => ['lat' => 14.6492, 'lng' => 121.0701]],
                            'types' => ['establishment'],
                            'address_components' => [
                                ['long_name' => 'Quezon City', 'types' => ['locality']],
                                ['long_name' => 'Metro Manila', 'types' => ['administrative_area_level_1']],
                            ],
                        ],
                    ]),
                    default => Http::response(['status' => 'NOT_FOUND']),
                };
            },
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
            ->assertJsonPath('data.candidates.0.name', 'FEU Institute of Technology')
            ->assertJsonPath('data.provider', 'google_places');

        $trace = GeocodingTrace::findOrFail($search->json('data.trace_id'));
        $this->assertSame('FEU', $trace->raw_input);
        $this->assertStringContainsString('Sampaloc', $trace->normalized_address);
        $this->assertCount(2, $trace->candidates);
        $this->assertFalse($trace->candidates[1]['eligible']);
        $this->assertSame('google_places', $trace->provider);

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
