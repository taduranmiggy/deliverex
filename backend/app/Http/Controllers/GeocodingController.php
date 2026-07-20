<?php

namespace App\Http\Controllers;

use App\Models\GeocodingTrace;
use App\Services\Geocoding\LocationAutocompleteService;
use App\Support\GpsCoordinateValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

class GeocodingController extends Controller
{
    public function __construct(private LocationAutocompleteService $autocomplete) {}

    public function index(Request $request)
    {
        $data = $request->validate([
            'context' => 'nullable|string|max:40',
            'status' => 'nullable|string|max:30',
            'provider' => 'nullable|string|max:40',
            'record_id' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        $query = GeocodingTrace::query()
            ->with('user:id,name')
            ->when($data['context'] ?? null, fn ($q, $value) => $q->where('context', $value))
            ->when($data['status'] ?? null, fn ($q, $value) => $q->where('status', $value))
            ->when($data['provider'] ?? null, fn ($q, $value) => $q->where('provider', $value))
            ->when($data['record_id'] ?? null, fn ($q, $value) => $q->where('record_id', $value))
            ->latest();

        return response()->json($query->paginate((int) ($data['per_page'] ?? 25), [
            'id', 'user_id', 'context', 'raw_input', 'normalized_address', 'provider',
            'selection_reason', 'selected_latitude', 'selected_longitude',
            'record_type', 'record_id', 'stored_latitude', 'stored_longitude',
            'api_latitude', 'api_longitude', 'rendered_latitude', 'rendered_longitude',
            'status', 'error_message', 'confirmed_at', 'rendered_at', 'created_at', 'updated_at',
        ]));
    }

    public function showTrace(GeocodingTrace $trace)
    {
        return response()->json(['data' => $trace->load('user:id,name')]);
    }

    public function autocomplete(Request $request)
    {
        $data = $request->validate([
            'query' => 'required|string|min:3|max:255',
            'context' => 'nullable|string|max:40',
            'region_code' => 'nullable|string|max:10',
            'province_code' => 'nullable|string|max:10',
            'city_code' => 'nullable|string|max:10',
            'barangay_code' => 'nullable|string|max:10',
            'region' => 'nullable|string|max:120',
            'province' => 'nullable|string|max:120',
            'city' => 'nullable|string|max:120',
            'barangay' => 'nullable|string|max:120',
        ]);

        try {
            $result = $this->autocomplete->search($data, $request->user());
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        return response()->json([
            'data' => [
                'trace_id' => $result['trace']->id,
                'normalized_address' => $result['trace']->normalized_address,
                'provider' => $result['trace']->provider,
                'candidates' => $result['candidates'],
            ],
        ]);
    }

    public function confirm(Request $request, GeocodingTrace $trace)
    {
        $this->assertTraceOwner($request, $trace);
        $data = $request->validate([
            'mode' => 'required|in:autocomplete,manual_pin',
            'candidate_id' => 'nullable|string|max:64',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);

        $selected = null;
        foreach ((array) $trace->candidates as $candidate) {
            if (is_array($candidate)
                && ($candidate['eligible'] ?? true) === true
                && ($candidate['id'] ?? null) === ($data['candidate_id'] ?? null)) {
                $selected = $candidate;
                break;
            }
        }

        if ($data['mode'] === 'autocomplete' && ! $selected) {
            throw ValidationException::withMessages([
                'candidate_id' => ['Select a location from the current suggestion list.'],
            ]);
        }

        $submitted = GpsCoordinateValidator::pair($data['latitude'], $data['longitude'], 'confirmed_location');
        if (! $submitted) {
            throw ValidationException::withMessages([
                'latitude' => ['Place the marker on a valid location within the Philippines.'],
            ]);
        }

        if ($data['mode'] === 'autocomplete') {
            $candidatePair = GpsCoordinateValidator::pair($selected['lat'] ?? null, $selected['lng'] ?? null, 'selected_candidate');
            if (! $candidatePair || GpsCoordinateValidator::distanceMeters(
                $submitted['lat'],
                $submitted['lng'],
                $candidatePair['lat'],
                $candidatePair['lng'],
            ) > 2) {
                throw ValidationException::withMessages([
                    'latitude' => ['The suggestion coordinates changed unexpectedly. Select the suggestion again.'],
                ]);
            }
            $submitted = $candidatePair;
        }

        $source = $data['mode'] === 'autocomplete' ? 'autocomplete_selection' : 'manual_pin';
        $trace->update([
            'selected_candidate' => $selected,
            'selection_reason' => $data['mode'] === 'autocomplete'
                ? 'user_selected_autocomplete_candidate'
                : 'user_dragged_and_confirmed_marker',
            'selected_latitude' => $submitted['lat'],
            'selected_longitude' => $submitted['lng'],
            'status' => 'confirmed',
            'confirmed_at' => now(),
        ]);

        $token = Crypt::encryptString(json_encode([
            'trace_id' => $trace->id,
            'user_id' => $request->user()?->id,
            'context' => $trace->context,
            'lat' => $submitted['lat'],
            'lng' => $submitted['lng'],
            'source' => $source,
            'provider' => $selected['provider'] ?? $trace->provider,
            'place_id' => $selected['place_id'] ?? null,
            'label' => $selected['label'] ?? $trace->normalized_address,
            'expires_at' => now()->addHours(4)->timestamp,
        ], JSON_THROW_ON_ERROR));

        return response()->json([
            'data' => [
                'trace_id' => $trace->id,
                'latitude' => $submitted['lat'],
                'longitude' => $submitted['lng'],
                'source' => $source,
                'confirmation_token' => $token,
            ],
        ]);
    }

    public function rendered(Request $request, GeocodingTrace $trace)
    {
        $this->assertTraceOwner($request, $trace, allowRecordViewer: true);
        $data = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);
        $pair = GpsCoordinateValidator::pair($data['latitude'], $data['longitude'], 'leaflet_rendered');
        if (! $pair) {
            throw ValidationException::withMessages(['latitude' => ['Invalid rendered coordinate pair.']]);
        }

        $mismatch = false;
        foreach ([
            [$trace->selected_latitude, $trace->selected_longitude],
            [$trace->stored_latitude, $trace->stored_longitude],
            [$trace->api_latitude, $trace->api_longitude],
        ] as [$lat, $lng]) {
            if ($lat !== null && $lng !== null && GpsCoordinateValidator::distanceMeters(
                (float) $lat,
                (float) $lng,
                $pair['lat'],
                $pair['lng'],
            ) > 0.05) {
                $mismatch = true;
                break;
            }
        }

        $trace->update([
            'rendered_latitude' => $pair['lat'],
            'rendered_longitude' => $pair['lng'],
            'rendered_at' => now(),
            'status' => $mismatch ? 'coordinate_mismatch' : 'rendered',
            'error_message' => $mismatch
                ? 'Leaflet rendered coordinates differ from an earlier pipeline stage.'
                : $trace->error_message,
        ]);

        return response()->noContent();
    }

    private function assertTraceOwner(Request $request, GeocodingTrace $trace, bool $allowRecordViewer = false): void
    {
        if ($trace->user_id !== null && (int) $trace->user_id === (int) $request->user()?->id) {
            return;
        }
        if ($allowRecordViewer && $trace->record_id !== null) {
            return;
        }

        abort(404);
    }
}
