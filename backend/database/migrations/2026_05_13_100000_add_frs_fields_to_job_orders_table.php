<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('job_orders', 'weight_kg')) {
                $table->decimal('weight_kg', 12, 2)->nullable()->after('vehicle_capacity_required');
            }
            if (! Schema::hasColumn('job_orders', 'volume_m3')) {
                $table->decimal('volume_m3', 12, 3)->nullable()->after('weight_kg');
            }
            if (! Schema::hasColumn('job_orders', 'scheduled_start')) {
                $table->timestamp('scheduled_start')->nullable()->after('volume_m3');
            }
            if (! Schema::hasColumn('job_orders', 'scheduled_end')) {
                $table->timestamp('scheduled_end')->nullable()->after('scheduled_start');
            }
            if (! Schema::hasColumn('job_orders', 'priority')) {
                $table->string('priority', 20)->default('normal')->after('scheduled_end');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $drops = array_filter([
                Schema::hasColumn('job_orders', 'weight_kg')       ? 'weight_kg'       : null,
                Schema::hasColumn('job_orders', 'volume_m3')       ? 'volume_m3'       : null,
                Schema::hasColumn('job_orders', 'scheduled_start') ? 'scheduled_start' : null,
                Schema::hasColumn('job_orders', 'scheduled_end')   ? 'scheduled_end'   : null,
                Schema::hasColumn('job_orders', 'priority')        ? 'priority'        : null,
            ]);
            if ($drops) {
                $table->dropColumn(array_values($drops));
            }
        });
    }
};
