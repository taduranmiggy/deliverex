<?php

namespace App\Support;

/**
 * Best-effort parsing of fleet "capacity" labels (e.g. "10 tons", "8000 kg") into kilograms.
 */
final class VehicleCapacity
{
    public static function labelToKg(?string $label): ?float
    {
        if ($label === null || trim($label) === '') {
            return null;
        }

        if (!preg_match('/(\d+(?:\.\d+)?)/', $label, $num)) {
            return null;
        }

        $value = (float) $num[1];
        $lower = strtolower($label);

        if (str_contains($lower, 'ton') || preg_match('/\b\d*\.?\d+\s*t\b/', $lower)) {
            return $value * 1000;
        }

        if (str_contains($lower, 'kg')) {
            return $value;
        }

        // Ambiguous numeric label — treat as metric tons (common in haulage briefs).
        return $value * 1000;
    }
}
