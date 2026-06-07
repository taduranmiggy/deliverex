<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('job_orders', 'material_type')) {
                $table->string('material_type', 80)->nullable()->after('dropoff_location');
            }
            if (! Schema::hasColumn('job_orders', 'specification_size')) {
                $table->string('specification_size', 120)->nullable()->after('material_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_orders', function (Blueprint $table) {
            $drops = array_filter([
                Schema::hasColumn('job_orders', 'material_type') ? 'material_type' : null,
                Schema::hasColumn('job_orders', 'specification_size') ? 'specification_size' : null,
            ]);
            if ($drops) {
                $table->dropColumn(array_values($drops));
            }
        });
    }
};
