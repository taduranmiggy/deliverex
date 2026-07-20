<?php

namespace App\Services\Geocoding;

use Illuminate\Support\Facades\Log;

final class LogGeocodeSelection
{
    /** @param  array<string, mixed>|string  $chosen */
    public static function log(string $rawInput, string $normalizedOrPlaceId, array|string $chosen): void
    {
        $payload = is_array($chosen) ? $chosen : ['label' => $chosen];

        Log::info('[google-geocode-pipeline] selection', [
            'raw_input' => $rawInput,
            'normalized_or_place_id' => $normalizedOrPlaceId,
            'place_id' => $payload['place_id'] ?? null,
            'latitude' => $payload['lat'] ?? null,
            'longitude' => $payload['lng'] ?? null,
            'label' => $payload['label'] ?? null,
        ]);
    }
}
