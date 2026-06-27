<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ocr_results', function (Blueprint $table): void {
            if (! Schema::hasColumn('ocr_results', 'ocr_diagnostics')) {
                $table->json('ocr_diagnostics')->nullable()->after('engine');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ocr_results', function (Blueprint $table): void {
            if (Schema::hasColumn('ocr_results', 'ocr_diagnostics')) {
                $table->dropColumn('ocr_diagnostics');
            }
        });
    }
};
