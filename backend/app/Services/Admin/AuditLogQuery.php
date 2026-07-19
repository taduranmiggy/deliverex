<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\Reports\ExportDateRange;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AuditLogQuery
{
    /** @return array{query: Builder, filters: array<string, string|null>} */
    public function build(Request $request): array
    {
        $range = ExportDateRange::resolveOptional($request);
        $request = ExportDateRange::mergeIntoRequest($request, $range);

        $module = $request->query('module');
        $user = $request->query('user');
        $role = $request->query('role');
        $action = $request->query('action');
        $from = $request->query('from');
        $to = $request->query('to');
        $search = trim((string) $request->query('search', ''));
        $jobOrderId = $request->query('job_order_id');
        $companyId = $request->query('company_id');

        $query = AuditLog::query()->with('user.role');

        if ($module && $module !== 'all') {
            $query->where(function ($q) use ($module) {
                $q->where('action', 'like', $module.'.%')
                    ->orWhere('module', config("audit.modules.{$module}", $module));
            });
        }

        if ($user && $user !== 'all') {
            $query->where(function ($q) use ($user) {
                if (is_numeric($user)) {
                    $q->where('user_id', (int) $user);
                } else {
                    $q->where('user_name', 'like', '%'.$user.'%')
                        ->orWhereHas('user', fn ($u) => $u
                            ->where('name', 'like', '%'.$user.'%')
                            ->orWhere('email', 'like', '%'.$user.'%'));
                }
            });
        }

        if ($role && $role !== 'all') {
            $query->where('role_name', $role);
        }

        if ($action && $action !== 'all') {
            $query->where('action', $action);
        }

        if (! $range['all_records'] && ($range['from'] || $range['to'])) {
            ExportDateRange::applyToQuery($query, 'created_at', $range['from'], $range['to']);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('module', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('user_name', 'like', "%{$search}%")
                    ->orWhere('role_name', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
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

        $sortDir = strtolower((string) $request->query('sort', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->reorder()->orderBy('created_at', $sortDir);

        $filters = [
            'module' => $module && $module !== 'all' ? (string) $module : null,
            'user' => $user && $user !== 'all' ? (string) $user : null,
            'role' => $role && $role !== 'all' ? (string) $role : null,
            'action' => $action && $action !== 'all' ? (string) $action : null,
            'from' => $range['from'],
            'to' => $range['to'],
            'all_records' => $range['all_records'] ? 'yes' : null,
            'search' => $search !== '' ? $search : null,
            'sort' => $sortDir,
        ];

        return ['query' => $query, 'filters' => $filters];
    }

    /** @return array<string, list<array{value: string, label: string}>> */
    public function options(): array
    {
        $configuredModules = array_values(array_unique(array_values(config('audit.modules', []))));
        $storedModules = AuditLog::query()->whereNotNull('module')->distinct()->orderBy('module')->pluck('module')->all();
        $modules = collect(array_merge($configuredModules, $storedModules))
            ->filter()->unique()->sort()->values()
            ->map(fn ($module) => ['value' => (string) $module, 'label' => (string) $module])
            ->all();

        $users = User::query()
            ->whereIn('id', AuditLog::query()->whereNotNull('user_id')->select('user_id'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => [
                'value' => (string) $user->id,
                'label' => (string) $user->name,
            ]);

        $snapshotUsers = AuditLog::query()
            ->whereNotNull('user_name')
            ->whereNull('user_id')
            ->select(['user_name'])
            ->distinct()
            ->orderBy('user_name')
            ->get()
            ->map(fn (AuditLog $log) => [
                'value' => (string) $log->user_name,
                'label' => (string) $log->user_name,
            ]);

        $users = $users->concat($snapshotUsers)->unique('value')->values()->all();

        $roles = AuditLog::query()->whereNotNull('role_name')->distinct()->orderBy('role_name')->pluck('role_name')
            ->map(fn ($role) => ['value' => (string) $role, 'label' => ucfirst((string) $role)])
            ->values()->all();

        $actions = AuditLog::query()->distinct()->orderBy('action')->pluck('action')
            ->map(fn ($action) => [
                'value' => (string) $action,
                'label' => ucwords(str_replace('_', ' ', (string) str($action)->afterLast('.'))),
            ])->values()->all();

        return compact('modules', 'users', 'roles', 'actions');
    }
}
