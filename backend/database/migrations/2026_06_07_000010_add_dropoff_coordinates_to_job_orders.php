<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->decimal('dropoff_latitude', 10, 7)->nullable()->after('dropoff_landmark');
            $table->decimal('dropoff_longitude', 10, 7)->nullable()->after('dropoff_latitude');
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->dropColumn(['dropoff_latitude', 'dropoff_longitude']);
        });
    }
};
