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

        foreach (self::structuredFieldChecks('dropoff', true) as $field => $message) {
            if (self::isMissingOrVague($data[$field] ?? null, $field === 'dropoff_street' ? 5 : 3)) {
                $errors[$field] = [$message];
            }
        }

        if (empty($data['quarry_id'])) {
            foreach (self::structuredFieldChecks('pickup', true) as $field => $message) {
                if (self::isMissingOrVague($data[$field] ?? null, $field === 'pickup_street' ? 5 : 3)) {
                    $errors[$field] = [$message];
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @return array<string, string>
     */
    private static function structuredFieldChecks(string $prefix, bool $required): array
    {
        if (! $required) {
            return [];
        }

        $labels = [
            'street' => 'Street / building / site name',
            'barangay' => 'Barangay',
            'city' => 'City / municipality',
            'province' => 'Province',
        ];

        $fields = [];
        foreach ($labels as $part => $label) {
            $fields["{$prefix}_{$part}"] = "{$label} is required with a specific, complete address.";
        }

        return $fields;
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
