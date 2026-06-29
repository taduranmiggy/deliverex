<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ocr_results', function (Blueprint $table): void {
            if (! Schema::hasColumn('ocr_results', 'field_corrections')) {
                $table->json('field_corrections')->nullable()->after('ocr_diagnostics');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ocr_results', function (Blueprint $table): void {
            if (Schema::hasColumn('ocr_results', 'field_corrections')) {
                $table->dropColumn('field_corrections');
            }
        });
    }
};
