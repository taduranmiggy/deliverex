<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->decimal('pickup_latitude', 10, 7)->nullable()->after('pickup_landmark');
            $table->decimal('pickup_longitude', 10, 7)->nullable()->after('pickup_latitude');
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->dropColumn(['pickup_latitude', 'pickup_longitude']);
        });
    }
};
