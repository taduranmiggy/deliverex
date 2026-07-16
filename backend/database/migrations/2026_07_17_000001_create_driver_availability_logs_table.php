<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_availability_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('drivers')->cascadeOnDelete();
            $table->string('previous_availability', 20);
            $table->string('new_availability', 20);
            $table->string('reason', 120);
            $table->foreignId('previous_assignment_id')->nullable()->constrained('dispatch_assignments')->nullOnDelete();
            $table->foreignId('current_assignment_id')->nullable()->constrained('dispatch_assignments')->nullOnDelete();
            $table->unsignedInteger('active_assignment_count')->default(0);
            $table->foreignId('triggered_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['driver_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_availability_logs');
    }
};
