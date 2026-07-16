<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogsController extends Controller
{
    public function index(Request $request)
    {
        $module = $request->query('module');
        $role = $request->query('role');
        $action = $request->query('action');
        $from = $request->query('from');
        $to = $request->query('to');
        $search = trim((string) $request->query('search', ''));
        $jobOrderId = $request->query('job_order_id');
        $companyId = $request->query('company_id');

        $query = AuditLog::with('user');

        if ($module && $module !== 'all') {
            $query->where(function ($q) use ($module) {
                $q->where('action', 'like', $module.'.%')
                    ->orWhere('module', config("audit.modules.{$module}", $module));
            });
        }

        if ($role && $role !== 'all') {
            $query->where('role_name', $role);
        }

        if ($action) {
            $query->where('action', 'like', '%'.$action.'%');
        }

        if ($from) {
            try {
                $query->where('created_at', '>=', \Illuminate\Support\Carbon::parse($from)->startOfDay());
            } catch (\Throwable) {
            }
        }

        if ($to) {
            try {
                $query->where('created_at', '<=', \Illuminate\Support\Carbon::parse($to)->endOfDay());
            } catch (\Throwable) {
            }
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('module', 'like', "%{$search}%")
                    ->orWhere('role_name', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"));
            });
        }

        if ($jobOrderId) {
            $query->where(function ($q) use ($jobOrderId) {
                $q->where('metadata->job_order_id', (int) $jobOrderId)
                    ->orWhere('subject_id', (int) $jobOrderId);
            });
        }

        if ($companyId) {
            $query->where('metadata->company_id', (int) $companyId);
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 6)));
        $sortDir = strtolower((string) $request->query('sort', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->reorder()->orderBy('created_at', $sortDir);

        $logs = $query->paginate($perPage);

        $logs->getCollection()->transform(function (AuditLog $log) {
            return [
                'id' => $log->id,
                'timestamp' => $log->created_at?->toIso8601String(),
                'user' => $log->user?->name ?? '—',
                'user_email' => $log->user?->email ?? null,
                'role' => $log->role_name ?? $log->user?->role?->name ?? null,
                'action' => $log->action,
                'module' => $log->module ?? $this->actionToModule($log->action),
                'subject_type' => $log->subject_type,
                'subject_id' => $log->subject_id,
                'details' => $this->formatDetails($log),
                'changes' => $log->changes,
                'metadata' => $log->metadata,
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'session_id' => $log->session_id,
            ];
        });

        return response()->json($logs);
    }

    private function actionToModule(string $action): string
    {
        return \App\Support\AuditLogger::resolveModule($action);
    }

    private function formatDetails(AuditLog $log): string
    {
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
