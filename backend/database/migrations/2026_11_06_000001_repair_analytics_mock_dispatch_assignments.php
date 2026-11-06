<?php

use App\Services\Fleet\AssignmentResourceSyncService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(AssignmentResourceSyncService::class)
            ->repairStaleBlockingAssignments('migration_analytics_mock_cleanup');
    }

    public function down(): void
    {
        // Data repair migration — synthetic historical state is intentionally terminal.
    }
};
