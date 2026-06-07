<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignment_audit_trails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('dispatch_assignments')->cascadeOnDelete();
            $table->foreignId('job_order_id')->constrained('job_orders')->cascadeOnDelete();
            $table->foreignId('dispatcher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('recommended_driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->foreignId('recommended_vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->string('recommended_driver_name')->nullable();
            $table->string('recommended_vehicle_plate')->nullable();
            $table->foreignId('assigned_driver_id')->constrained('drivers')->cascadeOnDelete();
            $table->foreignId('assigned_vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->string('assigned_driver_name');
            $table->string('assigned_vehicle_plate');
            $table->boolean('is_override')->default(false);
            $table->text('override_reason')->nullable();
            $table->decimal('best_fit_score', 8, 2)->nullable();
            $table->json('best_fit_reasons')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_audit_trails');
    }
};
