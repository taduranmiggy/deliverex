<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use App\Services\Email\EmailService;
use App\Services\Email\EmailType;
use Illuminate\Http\Request;

class EmailLogController extends Controller
{
    public function index(Request $request)
    {
        $query = EmailLog::query()
            ->with(['user:id,name,email', 'company:id,company_name'])
            ->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($type = $request->query('email_type')) {
            $query->where('email_type', $type);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('recipient', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        if ($from = $request->query('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->query('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($companyId = $request->query('company_id')) {
            $query->where('company_id', $companyId);
        }

        if ($userId = $request->query('user_id')) {
            $query->where('user_id', $userId);
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 6)));

        return response()->json($query->paginate($perPage));
    }

    public function types()
    {
        return response()->json([
            'types' => collect(EmailType::labels())->map(fn ($label, $value) => [
                'value' => $value,
                'label' => $label,
            ])->values(),
        ]);
    }

    public function retry(EmailLog $emailLog, EmailService $email)
    {
        if ($emailLog->status === EmailLog::STATUS_SENT) {
            return response()->json(['message' => 'Email already sent.', 'log' => $emailLog], 422);
        }

        try {
            $log = $email->retry($emailLog);

            return response()->json(['message' => 'Retry queued.', 'log' => $log->fresh()]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function stats()
    {
        $counts = EmailLog::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'pending' => (int) ($counts[EmailLog::STATUS_PENDING] ?? 0),
            'sent' => (int) ($counts[EmailLog::STATUS_SENT] ?? 0),
            'delivered' => (int) ($counts[EmailLog::STATUS_DELIVERED] ?? 0),
            'failed' => (int) ($counts[EmailLog::STATUS_FAILED] ?? 0),
        ]);
    }
}
