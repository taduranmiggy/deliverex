<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['companies', 'drivers'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->uuid('address_geocoding_trace_id')->nullable()->index();
                $table->string('address_coordinate_source', 40)->nullable();
                $table->string('address_coordinate_provider', 40)->nullable();
                $table->string('address_coordinate_place_id', 255)->nullable();
                $table->text('address_coordinate_label')->nullable();
                $table->timestamp('address_coordinate_confirmed_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['companies', 'drivers'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn([
                    'address_geocoding_trace_id',
                    'address_coordinate_source',
                    'address_coordinate_provider',
                    'address_coordinate_place_id',
                    'address_coordinate_label',
                    'address_coordinate_confirmed_at',
                ]);
            });
        }
    }
};
