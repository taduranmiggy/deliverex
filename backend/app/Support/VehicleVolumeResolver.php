<?php

namespace App\Support;

use App\Models\Vehicle;

/**
 * Resolve a vehicle's usable cargo volume (m³) from all known fleet fields.
 */
final class VehicleVolumeResolver
{
    /**
     * @return array{
     *     value_m3: ?float,
     *     primary_source: ?string,
     *     candidates: array<string, float>,
     *     comparison_operator: string
     * }
     */
    public static function resolve(Vehicle $vehicle): array
    {
        $vehicle->loadMissing('vehicleType');

        $candidates = [];

        if ($vehicle->cbm_capacity !== null && (float) $vehicle->cbm_capacity > 0) {
            $candidates['cbm_capacity'] = (float) $vehicle->cbm_capacity;
        }

        if ($vehicle->max_volume_m3 !== null && (float) $vehicle->max_volume_m3 > 0) {
            $candidates['max_volume_m3'] = (float) $vehicle->max_volume_m3;
        }

        if ($vehicle->raw_cbm_value !== null && (float) $vehicle->raw_cbm_value > 0) {
            $candidates['raw_cbm_value'] = (float) $vehicle->raw_cbm_value / 1_000_000;
        }

        $labelVolume = self::parseVolumeM3FromLabel($vehicle->capacity);
        if ($labelVolume !== null && $labelVolume > 0) {
            $candidates['capacity_label'] = $labelVolume;
        }

        if ($vehicle->rounded_cbm_capacity !== null && (int) $vehicle->rounded_cbm_capacity > 0) {
            $candidates['rounded_cbm_capacity'] = (float) $vehicle->rounded_cbm_capacity;
        }

        $fromDimensions = self::volumeFromDimensions($vehicle);
        if ($fromDimensions !== null && $fromDimensions > 0) {
            $candidates['dimensions_cm'] = $fromDimensions;
        }

        if ($vehicle->vehicleType?->max_cbm !== null && (float) $vehicle->vehicleType->max_cbm > 0) {
            $candidates['vehicle_type_max_cbm'] = (float) $vehicle->vehicleType->max_cbm;
        }

        if ($candidates === []) {
            return [
                'value_m3'              => null,
                'primary_source'        => null,
                'candidates'            => [],
                'comparison_operator'   => 'unknown_capacity_passes',
            ];
        }

        $priority = [
            'cbm_capacity',
            'max_volume_m3',
            'raw_cbm_value',
            'capacity_label',
            'rounded_cbm_capacity',
            'dimensions_cm',
            'vehicle_type_max_cbm',
        ];

        foreach ($priority as $source) {
            if (isset($candidates[$source])) {
                return [
                    'value_m3'            => $candidates[$source],
                    'primary_source'      => $source,
                    'candidates'          => $candidates,
                    'comparison_operator'   => 'numeric_gte',
                ];
            }
        }

        $firstKey = array_key_first($candidates);

        return [
            'value_m3'            => $candidates[$firstKey],
            'primary_source'      => $firstKey,
            'candidates'          => $candidates,
            'comparison_operator'   => 'numeric_gte',
        ];
    }

    public static function meetsRequired(Vehicle $vehicle, ?float $requiredVolumeM3): array
    {
        $resolved = self::resolve($vehicle);

        if ($requiredVolumeM3 === null || $requiredVolumeM3 <= 0) {
            return [
                'pass'        => true,
                'required_m3' => $requiredVolumeM3,
                'resolved'    => $resolved,
                'comparison'  => 'no_load_volume_required',
                'detail'      => 'Job has no positive load volume requirement.',
            ];
        }

        $capacity = $resolved['value_m3'];

        if ($capacity === null) {
            return [
                'pass'        => true,
                'required_m3' => $requiredVolumeM3,
                'resolved'    => $resolved,
                'comparison'  => sprintf('unknown capacity — allow (required %.3f m³)', $requiredVolumeM3),
                'detail'      => 'Vehicle capacity metadata missing; treated as eligible pending manual verification.',
            ];
        }

        $pass = $requiredVolumeM3 <= $capacity;

        return [
            'pass'        => $pass,
            'required_m3' => $requiredVolumeM3,
            'resolved'    => $resolved,
            'comparison'  => sprintf(
                '%s %.3f <= %.3f m³ (source: %s)',
                $pass ? 'PASS' : 'FAIL',
                $requiredVolumeM3,
                $capacity,
                $resolved['primary_source'] ?? 'unknown',
            ),
            'detail'      => $pass
                ? sprintf('Required %.3f m³ fits within vehicle capacity %.3f m³.', $requiredVolumeM3, $capacity)
                : sprintf('Required %.3f m³ exceeds vehicle capacity %.3f m³.', $requiredVolumeM3, $capacity),
        ];
    }

    public static function parseVolumeM3FromLabel(?string $label): ?float
    {
        if ($label === null || trim($label) === '') {
            return null;
        }

        $lower = strtolower(trim($label));

        if (preg_match('/\b(ton|tons|t\b|kg|kilogram)\b/', $lower)) {
            return null;
        }

        if (! preg_match('/(\d+(?:\.\d+)?)/', $label, $match)) {
            return null;
        }

        $value = (float) $match[1];

        if (preg_match('/\b(m3|m³|cbm|cubic\s*m|cu\.?\s*m)\b/', $lower)) {
            return $value;
        }

        if (! preg_match('/[a-z]/', $lower)) {
            return $value;
        }

        if (preg_match('/\bm3\b/', $lower) || str_contains($lower, 'm³')) {
            return $value;
        }

        return null;
    }

    private static function volumeFromDimensions(Vehicle $vehicle): ?float
    {
        if ($vehicle->length_cm === null || $vehicle->width_cm === null || $vehicle->height_cm === null) {
            return null;
        }

        $length = (float) $vehicle->length_cm;
        $width = (float) $vehicle->width_cm;
        $height = (float) $vehicle->height_cm;

        if ($length <= 0 || $width <= 0 || $height <= 0) {
            return null;
        }

        return round(($length / 100) * ($width / 100) * ($height / 100), 3);
    }
}
