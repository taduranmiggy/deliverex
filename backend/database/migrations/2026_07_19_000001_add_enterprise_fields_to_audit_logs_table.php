<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->string('user_name', 160)->nullable()->after('user_id');
            $table->text('description')->nullable()->after('module');
            $table->string('status', 16)->default('success')->after('description');

            $table->index('status');
        });

        // Preserve readable actor snapshots for historical rows even if a
        // user account is renamed or deleted later.
        DB::table('audit_logs')
            ->whereNotNull('user_id')
            ->whereNull('user_name')
            ->select(['id', 'user_id'])
            ->orderBy('id')
            ->chunkById(500, function ($logs): void {
                $users = DB::table('users')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.id')
                    ->whereIn('users.id', $logs->pluck('user_id')->filter()->unique())
                    ->select(['users.id', 'users.name', 'roles.name as role_name'])
                    ->get()
                    ->keyBy('id');

                foreach ($logs as $log) {
                    $actor = $users->get($log->user_id);
                    if (! $actor) {
                        continue;
                    }

                    DB::table('audit_logs')->where('id', $log->id)->update([
                        'user_name' => $actor->name,
                        'role_name' => $actor->role_name,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn(['user_name', 'description', 'status']);
        });
    }
};
