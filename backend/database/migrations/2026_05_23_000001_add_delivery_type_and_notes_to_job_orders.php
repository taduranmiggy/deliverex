<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('job_orders', 'delivery_type')) {
                $table->string('delivery_type', 80)->nullable()->after('dropoff_location');
            }
            if (! Schema::hasColumn('job_orders', 'notes')) {
                $table->text('notes')->nullable()->after('job_requirements');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $drops = array_filter([
                Schema::hasColumn('job_orders', 'delivery_type') ? 'delivery_type' : null,
                Schema::hasColumn('job_orders', 'notes') ? 'notes' : null,
            ]);
            if ($drops) {
                $table->dropColumn($drops);
            }
        });
    }
};
