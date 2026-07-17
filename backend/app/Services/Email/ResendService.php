<?php

namespace App\Services\Email;

use App\Mail\TemplateMail;
use App\Models\EmailLog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class ResendService
{
    public function sendLogged(EmailLog $log, string $html): EmailLog
    {
        if (config('mail.default') === 'resend' && empty(config('services.resend.key'))) {
            throw new \RuntimeException('RESEND_API_KEY is not configured.');
        }

        $log->increment('attempts');

        try {
            Mail::to($log->recipient)->send(new TemplateMail(
                mailSubject: $log->subject,
                htmlContent: $html,
                fromAddress: $log->from_address,
                fromName: config('mail.from.name'),
                replyToAddress: $log->metadata['reply_to'] ?? null,
                replyToName: config('mail.from.name'),
            ));

            $log->forceFill([
                'status' => EmailLog::STATUS_SENT,
                'sent_at' => now(),
                'failure_reason' => null,
            ])->save();

            return $log->fresh();
        } catch (Throwable $e) {
            Log::error('Resend email failed', [
                'email_log_id' => $log->id,
                'recipient' => $log->recipient,
                'type' => $log->email_type,
                'error' => $e->getMessage(),
            ]);

            $log->forceFill([
                'status' => EmailLog::STATUS_FAILED,
                'failure_reason' => $e->getMessage(),
            ])->save();

            throw $e;
        }
    }
}
