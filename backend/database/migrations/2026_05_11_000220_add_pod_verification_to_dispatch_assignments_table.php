<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_assignments', function (Blueprint $table) {
            if (!Schema::hasColumn('dispatch_assignments', 'pod_verified_at')) {
                $table->timestamp('pod_verified_at')->nullable()->after('completed_at');
            }
            if (!Schema::hasColumn('dispatch_assignments', 'pod_verified_by')) {
                $table->foreignId('pod_verified_by')
                    ->nullable()
                    ->after('pod_verified_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_assignments', function (Blueprint $table) {
            if (Schema::hasColumn('dispatch_assignments', 'pod_verified_by')) {
                $table->dropConstrainedForeignId('pod_verified_by');
            }
            if (Schema::hasColumn('dispatch_assignments', 'pod_verified_at')) {
                $table->dropColumn('pod_verified_at');
            }
        });
    }
};
