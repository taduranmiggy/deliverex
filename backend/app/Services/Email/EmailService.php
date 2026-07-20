<?php

namespace App\Services\Email;

use App\Jobs\SendEmailJob;
use App\Models\Company;
use App\Models\EmailLog;
use App\Models\User;
use Illuminate\Support\Facades\View;

class EmailService
{
    public function __construct(private readonly ResendService $resend) {}

    public function send(
        string $type,
        string $recipient,
        string $subject,
        string $view,
        array $viewData = [],
        ?string $from = null,
        ?int $userId = null,
        ?int $companyId = null,
        array $metadata = [],
        bool $forceSync = false,
    ): EmailLog {
        $recipient = strtolower(trim($recipient));
        $fromAddress = $from ?? $this->fromForType($type);

        $viewData = MailViewData::normalize($viewData);

        $log = EmailLog::query()->create([
            'email_type' => $type,
            'recipient' => $recipient,
            'subject' => $subject,
            'from_address' => $fromAddress,
            'status' => EmailLog::STATUS_PENDING,
            'provider' => 'resend',
            'user_id' => $userId,
            'company_id' => $companyId,
            'metadata' => array_merge($metadata, [
                'view' => $view,
                'view_data' => $viewData,
            ]),
        ]);

        if ($this->shouldQueue($type, $forceSync)) {
            SendEmailJob::dispatch($log->id);

            return $log;
        }

        $html = View::make($view, MailViewData::prepareForRender($viewData))->render();

        return $this->resend->sendLogged($log, $html);
    }

    public function retry(EmailLog $log): EmailLog
    {
        if ($log->status === EmailLog::STATUS_SENT) {
            return $log;
        }

        $view = $log->metadata['view'] ?? null;
        $data = MailViewData::prepareForRender($log->metadata['view_data'] ?? []);
        if (! $view) {
            throw new \RuntimeException('Cannot retry email without template metadata.');
        }

        if ($this->shouldQueue($log->email_type)) {
            $log->forceFill(['status' => EmailLog::STATUS_PENDING])->save();
            SendEmailJob::dispatch($log->id);

            return $log->fresh();
        }

        $html = View::make($view, $data)->render();

        return $this->resend->sendLogged($log, $html);
    }

    public function sendCompanyActivation(Company $company, string $activationUrl): EmailLog
    {
        $support = config('mail.addresses.support');

        return $this->send(
            EmailType::COMPANY_ACTIVATION,
            $company->company_email,
            'Activate your Deliverex company account — '.$company->company_name,
            'mail.company-activation',
            [
                'company' => $company,
                'activationUrl' => $activationUrl,
                'subject' => 'Activate your Deliverex company account',
            ],
            config('mail.addresses.accounts'),
            companyId: $company->id,
            metadata: ['reply_to' => $support],
        );
    }

    public function sendCompanyInvitation(User $user, Company $company, string $temporaryPassword): EmailLog
    {
        return $this->send(
            EmailType::COMPANY_INVITATION,
            $user->email,
            'You have been invited to '.$company->company_name.' on Deliverex',
            'mail.company-invitation',
            [
                'user' => $user,
                'company' => $company,
                'temporaryPassword' => $temporaryPassword,
                'loginUrl' => rtrim(config('app.url'), '/').'/login',
                'subject' => 'Company Invitation — Deliverex',
            ],
            config('mail.addresses.accounts'),
            userId: $user->id,
            companyId: $company->id,
        );
    }

    public function sendDriverCredentials(User $user, string $temporaryPassword): EmailLog
    {
        return $this->send(
            EmailType::DRIVER_CREDENTIALS,
            $user->email,
            'Your Deliverex Driver Account',
            'mail.driver-credentials',
            [
                'user' => $user,
                'temporaryPassword' => $temporaryPassword,
                'loginUrl' => rtrim(config('app.url'), '/').'/login',
                'subject' => 'Your Deliverex Driver Account',
            ],
            config('mail.addresses.accounts'),
            userId: $user->id,
        );
    }

    public function sendUserInvitation(User $user, string $inviteUrl): EmailLog
    {
        return $this->send(
            EmailType::USER_INVITATION,
            $user->email,
            'You have been invited to Deliverex',
            'mail.user-invitation',
            [
                'user' => $user,
                'inviteUrl' => $inviteUrl,
                'subject' => 'You have been invited to Deliverex',
            ],
            config('mail.addresses.accounts'),
            userId: $user->id,
            forceSync: true,
        );
    }

    public function sendPasswordReset(User $user, string $resetUrl): EmailLog
    {
        return $this->send(
            EmailType::PASSWORD_RESET,
            $user->email,
            'Reset Your Deliverex Password',
            'mail.password-reset',
            [
                'user' => $user,
                'resetUrl' => $resetUrl,
                'expiresMinutes' => config('auth.passwords.users.expire', 60),
                'subject' => 'Reset Your Deliverex Password',
            ],
            config('mail.addresses.noreply'),
            userId: $user->id,
        );
    }

    public function sendEmailVerification(User $user, string $verificationUrl): EmailLog
    {
        return $this->send(
            EmailType::EMAIL_VERIFICATION,
            $user->email,
            'Verify Your Deliverex Email',
            'mail.email-verification',
            [
                'user' => $user,
                'verificationUrl' => $verificationUrl,
                'subject' => 'Verify Your Deliverex Email',
            ],
            config('mail.addresses.noreply'),
            userId: $user->id,
        );
    }

    public function sendDeliveryNotification(
        string $type,
        string $recipient,
        string $subject,
        array $payload,
        ?int $userId = null,
        ?int $companyId = null,
    ): EmailLog {
        $viewMap = [
            EmailType::DELIVERY_ASSIGNED => 'mail.delivery-assigned',
            EmailType::DELIVERY_EN_ROUTE => 'mail.delivery-en-route',
            EmailType::DELIVERY_ARRIVED_AT_PICKUP => 'mail.delivery-arrived-at-pickup',
            EmailType::DELIVERY_ARRIVED => 'mail.delivery-arrived',
            EmailType::DELIVERY_COMPLETED => 'mail.delivery-completed',
            EmailType::POD_AVAILABLE => 'mail.pod-available',
        ];

        $view = $viewMap[$type] ?? 'mail.delivery-status';

        return $this->send(
            $type,
            $recipient,
            $subject,
            $view,
            array_merge($payload, ['subject' => $subject]),
            config('mail.addresses.noreply'),
            userId: $userId,
            companyId: $companyId,
        );
    }

    public function sendSupportInquiry(array $payload): EmailLog
    {
        $supportRecipient = strtolower(trim((string) config('mail.addresses.support')));
        $customerEmail = strtolower(trim((string) ($payload['email'] ?? '')));

        return $this->send(
            EmailType::SUPPORT_INQUIRY,
            $supportRecipient,
            '[Deliverex] New concern '.$payload['reference_no'].' — '.$payload['subject_line'],
            'mail.support-inquiry',
            array_merge($payload, ['subject' => 'New customer concern '.$payload['reference_no']]),
            config('mail.addresses.noreply'),
            metadata: [
                'reply_to' => filter_var($customerEmail, FILTER_VALIDATE_EMAIL) ? $customerEmail : null,
                'inquiry_id' => $payload['inquiry_id'] ?? null,
            ],
            forceSync: true,
        );
    }

    public function sendContactConfirmation(string $recipient, array $payload): EmailLog
    {
        $supportInbox = $this->supportInbox();

        return $this->send(
            EmailType::CONTACT_SUPPORT,
            $recipient,
            'We received your concern — '.$payload['reference_no'],
            'mail.contact-confirmation',
            array_merge($payload, ['subject' => 'We received your concern']),
            $this->supportFromAddress(),
            metadata: [
                'reply_to' => $supportInbox,
            ],
            forceSync: true,
        );
    }

    public function sendInquiryReply(string $recipient, array $payload): EmailLog
    {
        $supportInbox = $this->supportInbox();
        $reference = $payload['reference_no'] ?? 'Inquiry';

        return $this->send(
            EmailType::INQUIRY_REPLY,
            $recipient,
            'Re: '.$reference.(! empty($payload['subject_line']) ? ' — '.$payload['subject_line'] : ''),
            'mail.inquiry-reply',
            array_merge($payload, ['subject' => 'Reply to your concern']),
            $this->supportFromAddress(),
            metadata: [
                'reply_to' => $supportInbox,
                'inquiry_id' => $payload['inquiry_id'] ?? null,
            ],
            forceSync: true,
        );
    }

    public function sendSystemAlert(User $user, string $type, string $subject, array $payload): EmailLog
    {
        return $this->send(
            $type,
            $user->email,
            $subject,
            'mail.system-alert',
            array_merge($payload, [
                'user' => $user,
                'subject' => $subject,
                'alertType' => EmailType::labels()[$type] ?? 'System Alert',
            ]),
            config('mail.addresses.noreply'),
            userId: $user->id,
        );
    }

    /** Customer-facing From address (must be on a Resend-verified domain). */
    private function supportFromAddress(): string
    {
        $from = strtolower(trim((string) config('mail.addresses.support_from', '')));
        if ($from !== '' && filter_var($from, FILTER_VALIDATE_EMAIL) && ! $this->isPublicMailboxDomain($from)) {
            return $from;
        }

        $noreply = strtolower(trim((string) config('mail.addresses.noreply', '')));
        if ($noreply !== '' && filter_var($noreply, FILTER_VALIDATE_EMAIL)) {
            return $noreply;
        }

        return 'noreply@deliverexapp.com';
    }

    /** Staff inbox (may be Gmail) — used as Reply-To / notification recipient only. */
    private function supportInbox(): ?string
    {
        $support = strtolower(trim((string) config('mail.addresses.support', '')));

        return filter_var($support, FILTER_VALIDATE_EMAIL) ? $support : null;
    }

    private function isPublicMailboxDomain(string $email): bool
    {
        $domain = substr(strrchr($email, '@') ?: '', 1);
        if ($domain === '') {
            return true;
        }

        return in_array($domain, [
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
        ], true);
    }

    private function fromForType(string $type): string
    {
        return match ($type) {
            EmailType::COMPANY_ACTIVATION,
            EmailType::COMPANY_INVITATION,
            EmailType::DRIVER_CREDENTIALS,
            EmailType::USER_INVITATION => config('mail.addresses.accounts'),
            EmailType::CONTACT_SUPPORT,
            EmailType::INQUIRY_REPLY => $this->supportFromAddress(),
            EmailType::SUPPORT_INQUIRY => config('mail.addresses.noreply'),
            default => config('mail.addresses.noreply'),
        };
    }

    private function shouldQueue(string $type, bool $forceSync = false): bool
    {
        if ($forceSync) {
            return false;
        }

        if (in_array($type, [EmailType::SUPPORT_INQUIRY, EmailType::CONTACT_SUPPORT, EmailType::INQUIRY_REPLY], true)) {
            return false;
        }

        return (bool) config('mail.queue', false)
            && config('queue.default') !== 'sync';
    }
}
