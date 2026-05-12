<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            if (!Schema::hasColumn('drivers', 'current_assignment_id')) {
                $table->foreignId('current_assignment_id')
                    ->nullable()
                    ->after('availability')
                    ->constrained('dispatch_assignments')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            if (Schema::hasColumn('drivers', 'current_assignment_id')) {
                $table->dropConstrainedForeignId('current_assignment_id');
            }
        });
    }
};
