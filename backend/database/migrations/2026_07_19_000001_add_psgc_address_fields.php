<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            foreach (['pickup', 'dropoff'] as $prefix) {
                $table->string("{$prefix}_region_code", 10)->nullable()->index();
                $table->string("{$prefix}_region", 120)->nullable();
                $table->string("{$prefix}_province_code", 10)->nullable()->index();
                $table->string("{$prefix}_city_code", 10)->nullable()->index();
                $table->string("{$prefix}_barangay_code", 10)->nullable()->index();
                $table->text("{$prefix}_formatted_address")->nullable();
                $table->timestamp("{$prefix}_geocode_attempted_at")->nullable();
            }
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->string('address_region_code', 10)->nullable()->index();
            $table->string('address_region', 120)->nullable();
            $table->string('address_province_code', 10)->nullable()->index();
            $table->string('address_city_code', 10)->nullable()->index();
            $table->string('address_barangay_code', 10)->nullable()->index();
            $table->decimal('address_latitude', 10, 7)->nullable();
            $table->decimal('address_longitude', 10, 7)->nullable();
            $table->timestamp('address_geocode_attempted_at')->nullable();
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->text('address')->nullable();
            $table->string('address_street', 255)->nullable();
            $table->string('address_barangay', 120)->nullable();
            $table->string('address_city', 120)->nullable();
            $table->string('address_province', 120)->nullable();
            $table->string('address_region', 120)->nullable();
            $table->string('address_region_code', 10)->nullable()->index();
            $table->string('address_province_code', 10)->nullable()->index();
            $table->string('address_city_code', 10)->nullable()->index();
            $table->string('address_barangay_code', 10)->nullable()->index();
            $table->decimal('address_latitude', 10, 7)->nullable();
            $table->decimal('address_longitude', 10, 7)->nullable();
            $table->timestamp('address_geocode_attempted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn([
                'address', 'address_street', 'address_barangay', 'address_city',
                'address_province', 'address_region', 'address_region_code',
                'address_province_code', 'address_city_code', 'address_barangay_code',
                'address_latitude', 'address_longitude', 'address_geocode_attempted_at',
            ]);
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn([
                'address_region_code', 'address_region', 'address_province_code',
                'address_city_code', 'address_barangay_code', 'address_latitude',
                'address_longitude', 'address_geocode_attempted_at',
            ]);
        });

        Schema::table('job_orders', function (Blueprint $table) {
            $table->dropColumn([
                'pickup_region_code', 'pickup_region', 'pickup_province_code',
                'pickup_city_code', 'pickup_barangay_code', 'pickup_formatted_address',
                'pickup_geocode_attempted_at', 'dropoff_region_code', 'dropoff_region',
                'dropoff_province_code', 'dropoff_city_code', 'dropoff_barangay_code',
                'dropoff_formatted_address', 'dropoff_geocode_attempted_at',
            ]);
        });
    }
};
