<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use App\Support\AuditLogger;

class AuditLogPresenter
{
    /** @return array<string, mixed> */
    public function present(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'timestamp' => $log->created_at?->toIso8601String(),
            'user' => $log->user_name ?? $log->user?->name ?? 'System',
            'user_email' => $log->user?->email ?? null,
            'role' => $log->role_name ?? $log->user?->role?->name ?? null,
            'action' => $log->action,
            'module' => $log->module ?? AuditLogger::resolveModule((string) $log->action),
            'description' => $log->description ?? $this->formatDetails($log),
            'status' => $log->status ?? 'success',
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'details' => $this->formatDetails($log),
            'changes' => $log->changes,
            'metadata' => $log->metadata,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'session_id' => $log->session_id,
        ];
    }

    public function readableAction(?string $raw): string
    {
        if (! $raw) {
            return '—';
        }

        $parts = explode('.', $raw);
        $last = $parts[count($parts) - 1] ?? $raw;

        return ucwords(str_replace('_', ' ', $last));
    }

    public function formatDetails(AuditLog $log): string
    {
        if ($log->description) {
            return $log->description;
        }

        if (is_array($log->changes) && $log->changes !== []) {
            return collect($log->changes)
                ->map(fn ($change, $field) => sprintf(
                    '%s: %s → %s',
                    str_replace('_', ' ', (string) $field),
                    $this->formatChangeValue($change['old'] ?? null),
                    $this->formatChangeValue($change['new'] ?? null),
                ))
                ->implode('; ');
        }

        $meta = $log->metadata ?? [];
        if (! empty($meta['tracking_code'])) {
            return "Tracking: {$meta['tracking_code']}";
        }
        if (! empty($meta['email'])) {
            return "Email: {$meta['email']}";
        }
        if (! empty($meta['resource'])) {
            return 'Resource: '.$meta['resource'];
        }
        if ($log->subject_id) {
            $shortType = class_basename($log->subject_type ?? '');

            return "{$shortType} #{$log->subject_id}";
        }

        return '—';
    }

    private function formatChangeValue(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '—';
        }

        if (is_bool($value)) {
            return $value ? 'yes' : 'no';
        }

        return (string) $value;
    }
}
