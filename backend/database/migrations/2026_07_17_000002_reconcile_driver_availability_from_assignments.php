<?php

use App\Services\Fleet\AssignmentResourceSyncService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(AssignmentResourceSyncService::class)->reconcileAll('migration_backfill');
    }

    public function down(): void
    {
        // Data repair migration — no rollback.
    }
};
