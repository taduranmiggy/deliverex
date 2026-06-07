<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy combined location columns become nullable: quarry-sourced jobs and
        // structured-address jobs no longer always supply a combined string.
        Schema::table('job_orders', function (Blueprint $table) {
            $table->text('pickup_location')->nullable()->change();
            $table->text('dropoff_location')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->text('pickup_location')->nullable(false)->change();
            $table->text('dropoff_location')->nullable(false)->change();
        });
    }
};
