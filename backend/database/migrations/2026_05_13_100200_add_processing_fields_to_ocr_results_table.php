<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ocr_results', function (Blueprint $table) {
            $table->string('processing_status', 24)->default('pending')->after('document_id');
            $table->string('engine', 80)->nullable()->after('confidence_score');
            $table->text('error_message')->nullable()->after('engine');
        });
    }

    public function down(): void
    {
        Schema::table('ocr_results', function (Blueprint $table) {
            $table->dropColumn(['processing_status', 'engine', 'error_message']);
        });
    }
};
