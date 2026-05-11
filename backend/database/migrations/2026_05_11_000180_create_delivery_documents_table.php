<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('dispatch_assignments')->cascadeOnDelete();
            $table->string('file_path');
            $table->string('type', 20)->default('other');
            $table->foreignId('uploaded_by')->constrained('users');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_documents');
    }
};
