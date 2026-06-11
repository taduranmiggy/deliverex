<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-time data migration: fix driver records that were auto-provisioned
 * (via DriverAccount::resolve) before the full_name/status fix.
 *
 * Affected rows: drivers WHERE full_name IS NULL AND user_id IS NOT NULL
 *
 * For each affected row:
 *   - Sets full_name  = users.name
 *   - Sets status     = 'available'  (if NULL)
 *   - Sets availability = 'available' (if NULL)
 */
return new class extends Migration
{
    public function up(): void
    {
        // Load broken records (user-linked, no full_name)
        $broken = DB::table('drivers')
            ->whereNull('full_name')
            ->whereNotNull('user_id')
            ->get(['id', 'user_id', 'status', 'availability']);

        foreach ($broken as $driver) {
            $user = DB::table('users')
                ->where('id', $driver->user_id)
                ->value('name');

            if (!$user) {
                continue; // orphaned row — skip
            }

            DB::table('drivers')
                ->where('id', $driver->id)
                ->update([
                    'full_name'    => $user,
                    'status'       => $driver->status       ?? 'available',
                    'availability' => $driver->availability ?? 'available',
                ]);
        }
    }

    public function down(): void
    {
        // Not reversible — we do not want to blank out full_name values
    }
};
