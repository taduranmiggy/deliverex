<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuditLogger
{
    /**
     * @param  array<string, mixed>  $metadata
     * @param  array<string, array{old: mixed, new: mixed}>|null  $changes
     */
    public static function record(
        ?User $user,
        string $action,
        ?string $subjectType = null,
        ?int $subjectId = null,
        array $metadata = [],
        ?Request $request = null,
        ?array $changes = null,
    ): void {
        try {
            $resolvedChanges = $changes ?? ($metadata['changes'] ?? null);
            if (is_array($resolvedChanges) && $resolvedChanges !== []) {
                $resolvedChanges = AuditChangeTracker::redact($resolvedChanges);
                $metadata['changes'] = $resolvedChanges;
            } else {
                $resolvedChanges = null;
            }

            AuditLog::query()->create([
                'user_id' => $user?->id,
                'role_name' => $user?->relationLoaded('role')
                    ? $user->role?->name
                    : ($user?->loadMissing('role')->role?->name),
                'action' => $action,
                'module' => self::resolveModule($action),
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'metadata' => $metadata ?: null,
                'changes' => $resolvedChanges,
                'ip_address' => $request?->ip(),
                'user_agent' => self::truncateUserAgent($request?->userAgent()),
                'session_id' => self::resolveSessionId($request),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Audit log write failed', [
                'action' => $action,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @param  array<string, array{old: mixed, new: mixed}>  $changes
     * @param  array<string, mixed>  $metadata
     */
    public static function recordChanges(
        ?User $user,
        string $action,
        ?string $subjectType,
        ?int $subjectId,
        array $changes,
        array $metadata = [],
        ?Request $request = null,
    ): void {
        if ($changes === []) {
            return;
        }

        self::record($user, $action, $subjectType, $subjectId, $metadata, $request, $changes);
    }

    public static function resolveModule(string $action): string
    {
        $prefix = explode('.', $action, 2)[0] ?? 'system';
        $modules = config('audit.modules', []);

        return $modules[$prefix] ?? ucfirst(str_replace('_', ' ', $prefix));
    }

    private static function resolveSessionId(?Request $request): ?string
    {
        if (! $request) {
            return null;
        }

        $sessionId = $request->attributes->get('auth_session_id');

        return is_string($sessionId) && $sessionId !== '' ? $sessionId : null;
    }

    private static function truncateUserAgent(?string $userAgent): ?string
    {
        if ($userAgent === null || $userAgent === '') {
            return null;
        }

        return mb_substr($userAgent, 0, 512);
    }
}
