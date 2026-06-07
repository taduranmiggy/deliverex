<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_status_logs', function (Blueprint $table) {
            $table->decimal('latitude', 10, 7)->nullable()->after('notes');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->boolean('arrival_verified')->nullable()->after('longitude');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_status_logs', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'arrival_verified']);
        });
    }
};
