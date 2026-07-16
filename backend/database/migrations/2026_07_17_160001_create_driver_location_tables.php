<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_location_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('drivers')->cascadeOnDelete();
            $table->foreignId('assignment_id')->nullable()->constrained('dispatch_assignments')->nullOnDelete();
            $table->foreignId('job_order_id')->nullable()->constrained('job_orders')->nullOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('speed_kmh', 8, 3)->nullable();
            $table->decimal('heading', 6, 2)->nullable();
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->unsignedTinyInteger('battery_level')->nullable();
            $table->timestamp('captured_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['driver_id', 'captured_at']);
            $table->index(['assignment_id', 'captured_at']);
            $table->index(['job_order_id', 'captured_at']);
        });

        Schema::create('driver_current_locations', function (Blueprint $table) {
            $table->foreignId('driver_id')->primary()->constrained('drivers')->cascadeOnDelete();
            $table->foreignId('assignment_id')->nullable()->constrained('dispatch_assignments')->nullOnDelete();
            $table->foreignId('job_order_id')->nullable()->constrained('job_orders')->nullOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('speed_kmh', 8, 3)->nullable();
            $table->decimal('heading', 6, 2)->nullable();
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->unsignedTinyInteger('battery_level')->nullable();
            $table->timestamp('captured_at');
            $table->timestamp('updated_at')->useCurrent();
        });

        Schema::table('driver_current_locations', function (Blueprint $table) {
            $table->index('assignment_id');
            $table->index('job_order_id');
            $table->index('updated_at');
        });

        Schema::table('tracking_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('tracking_logs', 'battery_level')) {
                $table->unsignedTinyInteger('battery_level')->nullable()->after('speed_kmh');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tracking_logs', function (Blueprint $table) {
            if (Schema::hasColumn('tracking_logs', 'battery_level')) {
                $table->dropColumn('battery_level');
            }
        });

        Schema::dropIfExists('driver_current_locations');
        Schema::dropIfExists('driver_location_history');
    }
};
