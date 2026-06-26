<?php

namespace App\Jobs;

use App\Models\EmailLog;
use App\Services\Email\ResendService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\View;
use Throwable;

class SendEmailJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 120, 300];

    public function __construct(public int $emailLogId) {}

    public function handle(ResendService $resend): void
    {
        $log = EmailLog::query()->find($this->emailLogId);
        if (! $log || $log->status === EmailLog::STATUS_SENT) {
            return;
        }

        $view = $log->metadata['view'] ?? null;
        $data = $log->metadata['view_data'] ?? [];
        if (! $view) {
            $log->forceFill([
                'status' => EmailLog::STATUS_FAILED,
                'failure_reason' => 'Missing template view in metadata.',
            ])->save();

            return;
        }

        $html = View::make($view, $data)->render();
        $resend->sendLogged($log, $html);
    }

    public function failed(?Throwable $exception): void
    {
        $log = EmailLog::query()->find($this->emailLogId);
        if (! $log) {
            return;
        }

        $log->forceFill([
            'status' => EmailLog::STATUS_FAILED,
            'failure_reason' => $exception?->getMessage() ?? 'Queue job failed after retries.',
        ])->save();
    }
}
