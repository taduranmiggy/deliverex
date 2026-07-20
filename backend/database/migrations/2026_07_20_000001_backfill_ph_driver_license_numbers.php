<?php

use App\Services\Driver\DriverLicenseBackfillService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(DriverLicenseBackfillService::class)->backfillMissingLicenses();
    }

    public function down(): void
    {
        // Generated placeholder data — no rollback.
    }
};
