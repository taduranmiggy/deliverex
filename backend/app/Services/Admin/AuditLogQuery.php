<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
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

        if ($role && $role !== 'all') {
            $query->where('role_name', $role);
        }

        if ($action) {
            $query->where('action', 'like', '%'.$action.'%');
        }

        if (! $range['all_records'] && ($range['from'] || $range['to'])) {
            ExportDateRange::applyToQuery($query, 'created_at', $range['from'], $range['to']);
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

        $sortDir = strtolower((string) $request->query('sort', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->reorder()->orderBy('created_at', $sortDir);

        $filters = [
            'module' => $module && $module !== 'all' ? (string) $module : null,
            'role' => $role && $role !== 'all' ? (string) $role : null,
            'action' => $action ? (string) $action : null,
            'from' => $range['from'],
            'to' => $range['to'],
            'all_records' => $range['all_records'] ? 'yes' : null,
            'search' => $search !== '' ? $search : null,
            'sort' => $sortDir,
        ];

        return ['query' => $query, 'filters' => $filters];
    }
}
