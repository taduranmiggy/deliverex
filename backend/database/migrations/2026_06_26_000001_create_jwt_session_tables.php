<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FR 1.12 / FR 1.19 / FR 1.20 — persistent JWT sessions, driver device binding, offline sync audit.
 *
 * Note: Laravel already uses the `sessions` table for web guard storage.
 * We use `user_sessions` as the application session registry required by the spec.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_id', 64)->nullable()->index();
            $table->string('device_label', 120)->nullable();
            $table->string('platform', 20)->default('web'); // web | pwa | mobile
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('last_active_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
        });

        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->uuid('user_session_id');
            $table->foreign('user_session_id')->references('id')->on('user_sessions')->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('rotated_from_id')->nullable()->constrained('refresh_tokens')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_session_id', 'revoked_at']);
        });

        // FR 1.19 — one active device session per driver.
        Schema::create('driver_device_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_user_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('user_session_id');
            $table->foreign('user_session_id')->references('id')->on('user_sessions')->cascadeOnDelete();
            $table->string('device_id', 64);
            $table->foreignId('refresh_token_id')->nullable()->constrained('refresh_tokens')->nullOnDelete();
            $table->timestamp('last_active_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['driver_user_id', 'device_id']);
            $table->index(['driver_user_id', 'is_active']);
        });

        // FR 1.20 — server-side mirror of driver offline queue (audit + recovery).
        Schema::create('offline_sync_queue', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_id', 64)->nullable();
            $table->string('client_queue_id', 64)->nullable()->index();
            $table->string('action_type', 40);
            $table->json('payload');
            $table->timestamp('action_timestamp')->nullable();
            $table->string('status', 20)->default('pending'); // pending | synced | failed
            $table->text('last_error')->nullable();
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_sync_queue');
        Schema::dropIfExists('driver_device_sessions');
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('user_sessions');
    }
};
