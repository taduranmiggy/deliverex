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
        ?string $description = null,
        ?string $status = null,
        ?string $module = null,
    ): void {
        try {
            $request ??= self::currentRequest();
            $resolvedChanges = $changes ?? ($metadata['changes'] ?? null);
            if (is_array($resolvedChanges) && $resolvedChanges !== []) {
                $resolvedChanges = AuditChangeTracker::redact($resolvedChanges);
                $metadata['changes'] = $resolvedChanges;
            } else {
                $resolvedChanges = null;
            }

            AuditLog::query()->create([
                'user_id' => $user?->id,
                'user_name' => $user?->name ?? self::metadataActorName($metadata),
                'role_name' => $user?->relationLoaded('role')
                    ? $user->role?->name
                    : ($user?->loadMissing('role')->role?->name),
                'action' => $action,
                'module' => $module ?? self::resolveModule($action),
                'description' => $description ?? self::describe($user, $action, $subjectType, $subjectId, $metadata),
                'status' => $status ?? self::resolveStatus($action),
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'metadata' => $metadata ?: null,
                'changes' => $resolvedChanges,
                'ip_address' => $request?->ip(),
                'user_agent' => self::truncateUserAgent($request?->userAgent()),
                'session_id' => self::resolveSessionId($request),
            ]);

            $request?->attributes->set('audit_log_recorded', true);
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

    /** @param array<string, mixed> $metadata */
    public static function describe(
        ?User $user,
        string $action,
        ?string $subjectType = null,
        ?int $subjectId = null,
        array $metadata = [],
    ): string {
        $actor = $user?->name ?? self::metadataActorName($metadata) ?? 'System';
        $rawVerb = str_replace('_', ' ', (string) str($action)->afterLast('.'));
        $verb = ucfirst($rawVerb !== '' ? $rawVerb : 'performed action');
        $subject = $subjectType ? trim((string) preg_replace('/(?<!^)[A-Z]/', ' $0', class_basename($subjectType))) : '';

        $recordLabel = $metadata['tracking_code']
            ?? $metadata['reference_no']
            ?? $metadata['plate_no']
            ?? $metadata['driver_name']
            ?? null;

        if ($recordLabel === null && $subjectId !== null) {
            $recordLabel = '#'.$subjectId;
        }

        return trim(implode(' ', array_filter([
            $actor,
            strtolower($verb),
            $subject,
            $recordLabel !== null ? (string) $recordLabel : null,
        ]))).'.';
    }

    private static function resolveStatus(string $action): string
    {
        return str_contains($action, 'failed') || str_contains($action, 'failure')
            ? 'failed'
            : 'success';
    }

    /** @param array<string, mixed> $metadata */
    private static function metadataActorName(array $metadata): ?string
    {
        foreach (['user_name', 'name', 'email'] as $key) {
            if (isset($metadata[$key]) && is_scalar($metadata[$key]) && trim((string) $metadata[$key]) !== '') {
                return mb_substr(trim((string) $metadata[$key]), 0, 160);
            }
        }

        return null;
    }

    private static function currentRequest(): ?Request
    {
        if (! app()->bound('request')) {
            return null;
        }

        $request = app('request');

        return $request instanceof Request ? $request : null;
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
