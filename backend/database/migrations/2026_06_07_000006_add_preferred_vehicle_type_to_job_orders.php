<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->foreignId('preferred_vehicle_type_id')
                ->nullable()
                ->after('quarry_id')
                ->constrained('vehicle_types')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('preferred_vehicle_type_id');
        });
    }
};
