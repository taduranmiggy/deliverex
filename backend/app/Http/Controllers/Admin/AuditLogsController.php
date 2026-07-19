<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\AuditLogExportService;
use App\Services\Admin\AuditLogPresenter;
use App\Services\Admin\AuditLogQuery;
use Illuminate\Http\Request;

class AuditLogsController extends Controller
{
    public function __construct(
        private AuditLogQuery $auditLogQuery,
        private AuditLogPresenter $presenter,
        private AuditLogExportService $exportService,
    ) {
    }

    public function index(Request $request)
    {
        ['query' => $query] = $this->auditLogQuery->build($request);

        $perPage = min(100, max(1, (int) $request->query('per_page', 25)));
        $logs = $query->paginate($perPage);

        $logs->getCollection()->transform(fn ($log) => $this->presenter->present($log));

        return response()->json(array_merge($logs->toArray(), [
            'filter_options' => $this->auditLogQuery->options(),
        ]));
    }

    public function export(Request $request)
    {
        return $this->exportService->export($request);
    }
}
