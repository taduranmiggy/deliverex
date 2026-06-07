<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            if (Schema::hasColumn('drivers', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable()->change();
            }
            if (Schema::hasColumn('drivers', 'license_no')) {
                $table->string('license_no', 60)->nullable()->change();
            }
            if (Schema::hasColumn('drivers', 'availability')) {
                $table->string('availability', 20)->default('available')->change();
            }
        });

        Schema::table('vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('vehicles', 'status')) {
                $table->string('status', 20)->default('available')->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            if (Schema::hasColumn('drivers', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable(false)->change();
            }
            if (Schema::hasColumn('drivers', 'license_no')) {
                $table->string('license_no', 60)->nullable(false)->change();
            }
        });
    }
};
