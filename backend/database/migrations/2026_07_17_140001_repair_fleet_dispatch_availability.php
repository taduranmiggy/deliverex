<?php

use App\Services\Fleet\AssignmentResourceSyncService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // One-time data repair: drivers with a real license number but no expiry date
        // were incorrectly filtered out of best-fit after license validation shipped.
        DB::table('drivers')
            ->whereNotNull('license_no')
            ->where('license_no', 'not like', 'PENDING-%')
            ->whereNull('license_expiry')
            ->update(['license_expiry' => now()->addYear()->toDateString()]);

        app(AssignmentResourceSyncService::class)->repairStaleBlockingAssignments('migration_stale_assignment_cleanup');
        app(AssignmentResourceSyncService::class)->reconcileAll('migration_fleet_dispatch_repair');
    }

    public function down(): void
    {
        // Data repair migration — no rollback.
    }
};
