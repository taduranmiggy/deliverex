<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->string('role_name', 40)->nullable()->after('user_id');
            $table->string('module', 60)->nullable()->after('action');
            $table->string('user_agent', 512)->nullable()->after('ip_address');
            $table->uuid('session_id')->nullable()->after('user_agent');
            $table->json('changes')->nullable()->after('metadata');

            $table->index('module');
            $table->index('action');
            $table->index(['user_id', 'created_at']);
            $table->index('role_name');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['module']);
            $table->dropIndex(['action']);
            $table->dropIndex(['user_id', 'created_at']);
            $table->dropIndex(['role_name']);
            $table->dropColumn(['role_name', 'module', 'user_agent', 'session_id', 'changes']);
        });
    }
};
