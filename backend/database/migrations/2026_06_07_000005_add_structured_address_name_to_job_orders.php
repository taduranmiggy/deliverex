<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            // Structured customer name fields (added after customer_name)
            $table->string('customer_first_name', 80)->nullable()->after('customer_name');
            $table->string('customer_middle_name', 80)->nullable()->after('customer_first_name');
            $table->string('customer_last_name', 80)->nullable()->after('customer_middle_name');
            $table->string('customer_suffix', 20)->nullable()->after('customer_last_name');

            // Structured pickup address fields (added after pickup_location)
            $table->string('pickup_province', 100)->nullable()->after('pickup_location');
            $table->string('pickup_city', 100)->nullable()->after('pickup_province');
            $table->string('pickup_barangay', 100)->nullable()->after('pickup_city');
            $table->string('pickup_street', 255)->nullable()->after('pickup_barangay');
            $table->string('pickup_landmark', 255)->nullable()->after('pickup_street');

            // Structured drop-off address fields (added after dropoff_location)
            $table->string('dropoff_province', 100)->nullable()->after('dropoff_location');
            $table->string('dropoff_city', 100)->nullable()->after('dropoff_province');
            $table->string('dropoff_barangay', 100)->nullable()->after('dropoff_city');
            $table->string('dropoff_street', 255)->nullable()->after('dropoff_barangay');
            $table->string('dropoff_landmark', 255)->nullable()->after('dropoff_street');
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $table->dropColumn([
                'customer_first_name', 'customer_middle_name', 'customer_last_name', 'customer_suffix',
                'pickup_province', 'pickup_city', 'pickup_barangay', 'pickup_street', 'pickup_landmark',
                'dropoff_province', 'dropoff_city', 'dropoff_barangay', 'dropoff_street', 'dropoff_landmark',
            ]);
        });
    }
};
