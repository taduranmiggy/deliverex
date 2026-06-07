<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data backfill: link existing vehicles to the vehicle_types master record via the
 * vehicle_type_id foreign key, matching on the legacy `type` label. Where several
 * vehicle types share a name (e.g. capacity variants of "Dump Truck"), the variant
 * whose [min_cbm, max_cbm] range best fits the vehicle's CBM is chosen.
 *
 * This makes Best-Fit rely on relational data; name-based matching remains only as a
 * runtime fallback for any vehicle that still lacks a link.
 */
return new class extends Migration
{
    public function up(): void
    {
        $types = DB::table('vehicle_types')->get();
        if ($types->isEmpty()) {
            return;
        }

        $typesByName = [];
        foreach ($types as $type) {
            $typesByName[strtolower(trim((string) $type->name))][] = $type;
        }

        $vehicles = DB::table('vehicles')
            ->whereNull('vehicle_type_id')
            ->get();

        foreach ($vehicles as $vehicle) {
            $key = strtolower(trim((string) $vehicle->type));
            if ($key === '' || ! isset($typesByName[$key])) {
                continue;
            }

            $candidates = $typesByName[$key];
            $chosen = $this->chooseBestType($candidates, $vehicle);

            if ($chosen !== null) {
                DB::table('vehicles')
                    ->where('id', $vehicle->id)
                    ->update(['vehicle_type_id' => $chosen->id]);
            }
        }
    }

    public function down(): void
    {
        // Intentionally irreversible: a data backfill cannot be safely reverted because
        // legitimate links would be indistinguishable from backfilled ones.
    }

    private function chooseBestType(array $candidates, object $vehicle): ?object
    {
        if (count($candidates) === 1) {
            return $candidates[0];
        }

        $cbm = $vehicle->cbm_capacity
            ?? $vehicle->max_volume_m3
            ?? $vehicle->rounded_cbm_capacity
            ?? null;

        if ($cbm === null) {
            return $candidates[0];
        }

        $cbm = (float) $cbm;
        $best = $candidates[0];
        $bestDistance = null;

        foreach ($candidates as $candidate) {
            $min = (float) $candidate->min_cbm;
            $max = (float) $candidate->max_cbm;

            if ($cbm >= $min && $cbm <= $max) {
                return $candidate;
            }

            $midpoint = ($min + $max) / 2;
            $distance = abs($cbm - $midpoint);
            if ($bestDistance === null || $distance < $bestDistance) {
                $bestDistance = $distance;
                $best = $candidate;
            }
        }

        return $best;
    }
};
