<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Services\Reports\ReportExportService;
use Illuminate\Http\Request;

class ReportExportController extends Controller
{
    public function __construct(private ReportExportService $exports)
    {
    }

    public function export(Request $request)
    {
        $type = (string) $request->query('type', 'deliveries');
        $role = $request->user()?->role?->name;
        $adminOnly = ['email_monitoring', 'system_logs'];

        if (in_array($type, $adminOnly, true) && $role !== 'admin') {
            abort(403, 'This report is restricted to administrators.');
        }

        if (! in_array($role, ['admin', 'manager'], true)) {
            abort(403, 'You are not allowed to export enterprise reports.');
        }

        return $this->exports->export($request);
    }
}
