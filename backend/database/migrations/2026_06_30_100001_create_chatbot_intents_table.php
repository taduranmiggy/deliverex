<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chatbot_intents', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('name', 120);
            $table->string('description', 500)->nullable();
            $table->text('answer');
            $table->string('owner', 120)->nullable();
            $table->json('keywords')->nullable();
            $table->json('training_phrases')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('hit_count')->default(0);
            $table->unsignedInteger('resolved_count')->default(0);
            $table->timestamps();
        });

        Schema::create('chatbot_interactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('intent_id')->nullable()->constrained('chatbot_intents')->nullOnDelete();
            $table->string('session_id', 64)->nullable();
            $table->text('user_message');
            $table->boolean('resolved')->default(true);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['intent_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chatbot_interactions');
        Schema::dropIfExists('chatbot_intents');
    }
};
