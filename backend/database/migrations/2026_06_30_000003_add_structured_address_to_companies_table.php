<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('address_street', 255)->nullable()->after('address');
            $table->string('address_barangay', 100)->nullable()->after('address_street');
            $table->string('address_city', 100)->nullable()->after('address_barangay');
            $table->string('address_province', 100)->nullable()->after('address_city');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn([
                'address_street',
                'address_barangay',
                'address_city',
                'address_province',
            ]);
        });
    }
};
