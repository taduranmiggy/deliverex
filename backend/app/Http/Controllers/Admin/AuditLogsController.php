<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogsController extends Controller
{
    public function index(Request $request)
    {
        $module   = $request->query('module');
        $from     = $request->query('from');
        $to       = $request->query('to');
        $search   = $request->query('search');

        $query = AuditLog::with('user')
            ->orderByDesc('created_at');

        if ($module && $module !== 'all') {
            $query->where('action', 'like', $module . '.%');
        }

        if ($from) {
            try {
                $query->where('created_at', '>=', \Illuminate\Support\Carbon::parse($from)->startOfDay());
            } catch (\Throwable) {}
        }

        if ($to) {
            try {
                $query->where('created_at', '<=', \Illuminate\Support\Carbon::parse($to)->endOfDay());
            } catch (\Throwable) {}
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                  ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            });
        }

        $logs = $query->paginate(50);

        $logs->getCollection()->transform(function (AuditLog $log) {
            return [
                'id'           => $log->id,
                'timestamp'    => $log->created_at?->toIso8601String(),
                'user'         => $log->user?->name ?? '—',
                'user_email'   => $log->user?->email ?? null,
                'action'       => $log->action,
                'module'       => $this->actionToModule($log->action),
                'subject_type' => $log->subject_type,
                'subject_id'   => $log->subject_id,
                'details'      => $this->formatDetails($log),
                'ip_address'   => $log->ip_address,
            ];
        });

        return response()->json($logs);
    }

    private function actionToModule(string $action): string
    {
        if (str_starts_with($action, 'auth.'))         return 'Auth';
        if (str_starts_with($action, 'job_order.'))    return 'Job Orders';
        if (str_starts_with($action, 'dispatch.'))     return 'Dispatch';
        if (str_starts_with($action, 'delivery.'))     return 'Delivery';
        if (str_starts_with($action, 'ocr.'))          return 'OCR Validation';
        if (str_starts_with($action, 'inquiry.'))      return 'Inquiries';
        return 'System';
    }

    private function formatDetails(AuditLog $log): string
    {
        $meta = $log->metadata ?? [];
        if (!empty($meta['tracking_code'])) {
            return "Tracking: {$meta['tracking_code']}";
        }
        if (!empty($meta['email'])) {
            return "Email: {$meta['email']}";
        }
        if ($log->subject_id) {
            $shortType = class_basename($log->subject_type ?? '');
            return "{$shortType} #{$log->subject_id}";
        }
        return '—';
    }
}
