<?php

namespace App\Services\Geocoding;

use App\Models\GeocodingTrace;
use App\Support\GpsCoordinateValidator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ConfirmedLocationService
{
    /** @return array<string, mixed>|null */
    public function fromPayload(
        array $data,
        string $prefix,
        bool $required = false,
        ?string $expectedStreet = null,
    ): ?array {
        $token = trim((string) ($data["{$prefix}_coordinate_confirmation_token"] ?? ''));
        if ($token === '') {
            if ($required) {
                throw ValidationException::withMessages([
                    "{$prefix}_address" => ['Select an address suggestion or place the marker manually, then confirm the pin.'],
                ]);
            }

            return null;
        }

        try {
            $payload = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => ['The confirmed map location is invalid or expired. Confirm the pin again.'],
            ]);
        }

        if (! is_array($payload) || (int) ($payload['expires_at'] ?? 0) < now()->timestamp) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => ['The confirmed map location has expired. Confirm the pin again.'],
            ]);
        }

        $userId = Auth::id();
        if (($payload['user_id'] ?? null) !== null && (int) $payload['user_id'] !== (int) $userId) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => ['This confirmed location belongs to another session. Confirm the pin again.'],
            ]);
        }

        if (($payload['context'] ?? null) !== null && (string) $payload['context'] !== $prefix) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => ['This confirmed pin belongs to a different address field. Confirm this location again.'],
            ]);
        }

        $pair = GpsCoordinateValidator::pair($payload['lat'] ?? null, $payload['lng'] ?? null, "confirmed_{$prefix}");
        if (! $pair) {
            throw ValidationException::withMessages([
                "{$prefix}_address" => ['The confirmed marker is outside the supported Philippine map area.'],
            ]);
        }

        $traceId = $payload['trace_id'] ?? null;
        if ($traceId) {
            $trace = GeocodingTrace::query()->find($traceId);
            $selected = is_array($trace?->selected_candidate) ? $trace->selected_candidate : [];
            $expectedLabel = trim((string) ($selected['name'] ?? $trace?->raw_input ?? ''));
            $streetKey = $this->textKey((string) $expectedStreet);
            $labelKey = $this->textKey($expectedLabel);
            $tracePairMatches = $trace
                && $trace->selected_latitude !== null
                && $trace->selected_longitude !== null
                && GpsCoordinateValidator::distanceMeters(
                    $trace->selected_latitude,
                    $trace->selected_longitude,
                    $pair['lat'],
                    $pair['lng'],
                ) <= 0.05;

            if (! $trace
                || (int) $trace->user_id !== (int) $userId
                || $trace->context !== $prefix
                || $trace->record_id !== null
                || $trace->confirmed_at === null
                || ! $tracePairMatches
                || ($streetKey !== '' && $labelKey !== ''
                    && ! str_contains($streetKey, $labelKey)
                    && ! str_contains($labelKey, $streetKey))) {
                throw ValidationException::withMessages([
                    "{$prefix}_address" => ['The confirmed location no longer matches this address. Search and confirm the pin again.'],
                ]);
            }
        }

        return [
            'lat' => $pair['lat'],
            'lng' => $pair['lng'],
            'trace_id' => $traceId,
            'source' => $payload['source'] ?? 'manual_pin',
            'provider' => $payload['provider'] ?? null,
            'place_id' => $payload['place_id'] ?? null,
            'label' => $payload['label'] ?? null,
            'confirmed_at' => now(),
        ];
    }

    private function textKey(string $value): string
    {
        $value = Str::lower(Str::ascii(trim($value)));

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value);
    }

    public function recordStored(?string $traceId, Model $record, string $prefix): void
    {
        if (! $traceId) {
            return;
        }

        $trace = GeocodingTrace::query()->find($traceId);
        if (! $trace) {
            return;
        }

        $storedLat = (float) $record->{"{$prefix}_latitude"};
        $storedLng = (float) $record->{"{$prefix}_longitude"};
        $mismatch = $trace->selected_latitude !== null
            && $trace->selected_longitude !== null
            && GpsCoordinateValidator::distanceMeters(
                $trace->selected_latitude,
                $trace->selected_longitude,
                $storedLat,
                $storedLng,
            ) > 0.05;

        $trace->update([
            'record_type' => $record->getMorphClass(),
            'record_id' => $record->getKey(),
            'stored_latitude' => $storedLat,
            'stored_longitude' => $storedLng,
            'status' => $mismatch ? 'coordinate_mismatch' : 'stored',
            'error_message' => $mismatch
                ? 'Coordinates changed between confirmation and database persistence.'
                : $trace->error_message,
        ]);
    }
}
