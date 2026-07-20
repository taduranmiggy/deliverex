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
            $fromAddress = $this->verifiedFromAddress($log->from_address);

            Mail::to($log->recipient)->send(new TemplateMail(
                mailSubject: $log->subject,
                htmlContent: $html,
                fromAddress: $fromAddress,
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

    /**
     * Resend only allows From addresses on verified domains.
     * Never send as Gmail/Yahoo/etc. even if misconfigured in .env.
     */
    private function verifiedFromAddress(?string $from): string
    {
        $email = strtolower(trim((string) $from));
        $publicDomains = [
            'gmail.com',
            'googlemail.com',
            'yahoo.com',
            'yahoo.com.ph',
            'outlook.com',
            'hotmail.com',
            'live.com',
            'icloud.com',
            'me.com',
            'aol.com',
            'proton.me',
            'protonmail.com',
        ];

        $domain = $email !== '' && str_contains($email, '@')
            ? substr(strrchr($email, '@'), 1)
            : '';

        if ($email !== ''
            && filter_var($email, FILTER_VALIDATE_EMAIL)
            && $domain !== ''
            && ! in_array($domain, $publicDomains, true)
        ) {
            return $email;
        }

        $fallback = strtolower(trim((string) (
            config('mail.addresses.support_from')
            ?: config('mail.addresses.noreply')
            ?: config('mail.from.address')
            ?: 'noreply@deliverexapp.com'
        )));

        $fallbackDomain = str_contains($fallback, '@') ? substr(strrchr($fallback, '@'), 1) : '';
        if ($fallback !== ''
            && filter_var($fallback, FILTER_VALIDATE_EMAIL)
            && $fallbackDomain !== ''
            && ! in_array($fallbackDomain, $publicDomains, true)
        ) {
            return $fallback;
        }

        return 'noreply@deliverexapp.com';
    }
}
