<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->decimal('max_weight_kg', 12, 2)->nullable()->after('capacity');
            $table->decimal('max_volume_m3', 12, 3)->nullable()->after('max_weight_kg');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['max_weight_kg', 'max_volume_m3']);
        });
    }
};
