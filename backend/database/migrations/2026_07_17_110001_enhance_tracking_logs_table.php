<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracking_logs', function (Blueprint $table) {
            $table->foreignId('driver_id')->nullable()->after('assignment_id')->constrained('drivers')->nullOnDelete();
            $table->decimal('accuracy_m', 8, 2)->nullable()->after('longitude');
            $table->decimal('heading', 6, 2)->nullable()->after('accuracy_m');
            $table->decimal('speed_kmh', 8, 3)->nullable()->after('heading');
            $table->string('source', 40)->nullable()->after('speed_kmh');
            $table->timestamp('synced_at')->nullable()->after('captured_at');
            $table->index(['assignment_id', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::table('tracking_logs', function (Blueprint $table) {
            $table->dropIndex(['assignment_id', 'captured_at']);
            $table->dropConstrainedForeignId('driver_id');
            $table->dropColumn(['accuracy_m', 'heading', 'speed_kmh', 'source', 'synced_at']);
        });
    }
};
