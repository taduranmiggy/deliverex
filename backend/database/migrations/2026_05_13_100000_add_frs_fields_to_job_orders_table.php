<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->decimal('weight_kg', 12, 2)->nullable()->after('vehicle_capacity_required');
            $table->decimal('volume_m3', 12, 3)->nullable()->after('weight_kg');
            $table->timestamp('scheduled_start')->nullable()->after('volume_m3');
            $table->timestamp('scheduled_end')->nullable()->after('scheduled_start');
            $table->string('priority', 20)->default('normal')->after('scheduled_end');
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->dropColumn([
                'weight_kg',
                'volume_m3',
                'scheduled_start',
                'scheduled_end',
                'priority',
            ]);
        });
    }
};
