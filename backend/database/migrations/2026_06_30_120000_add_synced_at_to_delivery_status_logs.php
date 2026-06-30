<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_status_logs', function (Blueprint $table) {
            $table->timestamp('synced_at')->nullable()->after('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_status_logs', function (Blueprint $table) {
            $table->dropColumn('synced_at');
        });
    }
};
