<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users');
            $table->string('tracking_code', 20)->unique();
            $table->string('customer_name', 120);
            $table->string('customer_contact', 50)->nullable();
            $table->text('pickup_location');
            $table->text('dropoff_location');
            $table->text('job_requirements')->nullable();
            $table->string('vehicle_type_required', 80)->nullable();
            $table->string('vehicle_capacity_required', 80)->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_orders');
    }
};
