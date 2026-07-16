<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class JobOrderAddressValidator
{
    /**
     * @param  array<string, mixed>  $data
     */
    public static function validatePayload(array $data): void
    {
        $errors = [];

        if (self::isMissingOrVague($data['dropoff_street'] ?? null, 5)
            && self::isMissingOrVague($data['dropoff_location'] ?? null, 5)) {
            $errors['dropoff_street'] = ['Destination street / site name is required with a specific, complete address.'];
        }

        if (empty($data['quarry_id'])) {
            if (self::isMissingOrVague($data['pickup_street'] ?? null, 5)
                && self::isMissingOrVague($data['pickup_location'] ?? null, 5)) {
                $errors['pickup_street'] = ['Pickup street / site name is required with a specific, complete address.'];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private static function isMissingOrVague(mixed $value, int $minLength = 3): bool
    {
        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return true;
        }

        if (mb_strlen($trimmed) < $minLength) {
            return true;
        }

        if (preg_match('/^(n\/?a|tbd|tba|none|unknown|site|location|address|here|somewhere|malapit|near|tabi|tapat)$/iu', $trimmed)) {
            return true;
        }

        if (mb_strlen($trimmed) < 12 && preg_match('/\b(near|malapit|somewhere|around|tabi ng|tapat ng|harp ng)\b/iu', $trimmed)) {
            return true;
        }

        return false;
    }
}
