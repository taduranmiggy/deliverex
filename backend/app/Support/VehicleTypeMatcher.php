<?php

namespace App\Support;

use App\Models\JobOrder;
use App\Models\Vehicle;

final class VehicleTypeMatcher
{
    /**
     * @return list<string>
     */
    public static function normalizeAliases(?string $value): array
    {
        if ($value === null) {
            return [];
        }

        $normalized = self::normalize($value);
        if ($normalized === null) {
            return [];
        }

        $aliases = [$normalized, self::compact($normalized)];

        if (preg_match('/(\d+)\s*wheeler/', $normalized, $match)) {
            $wheelCount = $match[1];
            $aliases[] = "{$wheelCount} wheeler";
            $aliases[] = "{$wheelCount}-wheeler";
            $aliases[] = "{$wheelCount}wheeler";
        }

        if ($normalized === 'adt' || str_contains($normalized, 'articulated dump')) {
            $aliases[] = 'adt';
            $aliases[] = 'articulated dump truck';
        }

        return array_values(array_unique(array_filter($aliases)));
    }

    public static function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = mb_strtolower(trim($value));
        $normalized = str_replace(['_', '-'], ' ', $normalized);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        return $normalized === '' ? null : $normalized;
    }

    public static function compact(string $value): string
    {
        return preg_replace('/\s+/', '', $value) ?? $value;
    }

    public static function equals(?string $left, ?string $right): bool
    {
        $leftAliases = self::normalizeAliases($left);
        $rightAliases = self::normalizeAliases($right);

        if ($leftAliases === [] || $rightAliases === []) {
            return false;
        }

        foreach ($leftAliases as $leftAlias) {
            foreach ($rightAliases as $rightAlias) {
                if ($leftAlias === $rightAlias || self::compact($leftAlias) === self::compact($rightAlias)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return array{
     *     matched: bool,
     *     match_method: ?string,
     *     required: array<string, mixed>,
     *     vehicle: array<string, mixed>,
     *     comparison: string
     * }
     */
    public static function evaluate(Vehicle $vehicle, JobOrder $jobOrder): array
    {
        $vehicle->loadMissing('vehicleType');
        $jobOrder->loadMissing('preferredVehicleType');

        $required = [
            'preferred_vehicle_type_id' => $jobOrder->preferred_vehicle_type_id,
            'preferred_type_name'       => $jobOrder->preferredVehicleType?->name,
            'preferred_wheel_type'      => $jobOrder->preferredVehicleType?->wheel_type,
            'vehicle_type_required'     => $jobOrder->vehicle_type_required,
            'normalized_aliases'        => self::requiredAliases($jobOrder),
        ];

        $vehicleInfo = [
            'vehicle_type_id'   => $vehicle->vehicle_type_id,
            'vehicle_type_name' => $vehicle->vehicleType?->name,
            'vehicle_wheel_type'=> $vehicle->vehicleType?->wheel_type,
            'vehicle_type_text' => $vehicle->type,
            'normalized_aliases'=> self::vehicleAliases($vehicle),
        ];

        if ($jobOrder->preferred_vehicle_type_id && $vehicle->vehicle_type_id) {
            if ((int) $vehicle->vehicle_type_id === (int) $jobOrder->preferred_vehicle_type_id) {
                return [
                    'matched'       => true,
                    'match_method'  => 'preferred_vehicle_type_id',
                    'required'      => $required,
                    'vehicle'       => $vehicleInfo,
                    'comparison'    => sprintf(
                        'PASS vehicle_type_id %d === preferred_vehicle_type_id %d',
                        $vehicle->vehicle_type_id,
                        $jobOrder->preferred_vehicle_type_id,
                    ),
                ];
            }
        }

        if ($required['normalized_aliases'] === []) {
            return [
                'matched'       => true,
                'match_method'  => 'no_type_required',
                'required'      => $required,
                'vehicle'       => $vehicleInfo,
                'comparison'    => 'PASS no vehicle type requirement on job',
            ];
        }

        foreach ($required['normalized_aliases'] as $requiredAlias) {
            foreach ($vehicleInfo['normalized_aliases'] as $vehicleAlias) {
                if (self::equals($requiredAlias, $vehicleAlias)) {
                    return [
                        'matched'       => true,
                        'match_method'  => 'normalized_alias',
                        'required'      => $required,
                        'vehicle'       => $vehicleInfo,
                        'comparison'    => sprintf(
                            'PASS alias "%s" matches "%s"',
                            $requiredAlias,
                            $vehicleAlias,
                        ),
                    ];
                }
            }
        }

        return [
            'matched'       => false,
            'match_method'  => null,
            'required'      => $required,
            'vehicle'       => $vehicleInfo,
            'comparison'    => sprintf(
                'FAIL required aliases [%s] vs vehicle aliases [%s]',
                implode(', ', $required['normalized_aliases']),
                implode(', ', $vehicleInfo['normalized_aliases']),
            ),
        ];
    }

    /**
     * @return list<string>
     */
    public static function requiredAliases(JobOrder $jobOrder): array
    {
        $jobOrder->loadMissing('preferredVehicleType');

        $values = array_filter([
            $jobOrder->preferredVehicleType?->name,
            $jobOrder->preferredVehicleType?->wheel_type,
            $jobOrder->vehicle_type_required,
        ], fn ($value) => $value !== null && trim((string) $value) !== '');

        $aliases = [];
        foreach ($values as $value) {
            $aliases = array_merge($aliases, self::normalizeAliases((string) $value));
        }

        return array_values(array_unique($aliases));
    }

    /**
     * @return list<string>
     */
    public static function vehicleAliases(Vehicle $vehicle): array
    {
        $vehicle->loadMissing('vehicleType');

        $values = array_filter([
            $vehicle->vehicleType?->name,
            $vehicle->vehicleType?->wheel_type,
            $vehicle->type,
        ], fn ($value) => $value !== null && trim((string) $value) !== '');

        $aliases = [];
        foreach ($values as $value) {
            $aliases = array_merge($aliases, self::normalizeAliases((string) $value));
        }

        return array_values(array_unique($aliases));
    }
}
