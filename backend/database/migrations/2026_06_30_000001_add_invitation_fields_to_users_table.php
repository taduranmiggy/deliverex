<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('invited_at')->nullable()->after('password_changed_at');
            $table->timestamp('invitation_accepted_at')->nullable()->after('invited_at');
            $table->unsignedSmallInteger('invite_send_count')->default(0)->after('invitation_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['invited_at', 'invitation_accepted_at', 'invite_send_count']);
        });
    }
};

