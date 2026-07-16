<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_status_history', function (Blueprint $table) {
            $table->string('previous_status', 80)->nullable()->after('status');
            $table->foreignId('driver_id')->nullable()->after('assignment_id')->constrained('drivers')->nullOnDelete();
        });

        $tables = ['dispatch_assignments', 'delivery_status_logs', 'delivery_status_history'];

        foreach ($tables as $table) {
            DB::table($table)->where('status', 'arrived')->update(['status' => 'arrived_at_destination']);
        }
    }

    public function down(): void
    {
        $tables = ['dispatch_assignments', 'delivery_status_logs', 'delivery_status_history'];

        foreach ($tables as $table) {
            DB::table($table)->where('status', 'arrived_at_destination')->update(['status' => 'arrived']);
        }

        Schema::table('delivery_status_history', function (Blueprint $table) {
            $table->dropConstrainedForeignId('driver_id');
            $table->dropColumn('previous_status');
        });
    }
};
