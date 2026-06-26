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
    ): EmailLog {
        $recipient = strtolower(trim($recipient));
        $fromAddress = $from ?? $this->fromForType($type);

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

        if ($this->shouldQueue()) {
            SendEmailJob::dispatch($log->id);

            return $log;
        }

        $html = View::make($view, $viewData)->render();

        return $this->resend->sendLogged($log, $html);
    }

    public function retry(EmailLog $log): EmailLog
    {
        if ($log->status === EmailLog::STATUS_SENT) {
            return $log;
        }

        $view = $log->metadata['view'] ?? null;
        $data = $log->metadata['view_data'] ?? [];
        if (! $view) {
            throw new \RuntimeException('Cannot retry email without template metadata.');
        }

        if ($this->shouldQueue()) {
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
        return $this->send(
            EmailType::SUPPORT_INQUIRY,
            config('mail.addresses.support'),
            'Customer Support Inquiry '.$payload['reference_no'],
            'mail.support-inquiry',
            array_merge($payload, ['subject' => 'Customer Support Inquiry '.$payload['reference_no']]),
            config('mail.addresses.noreply'),
        );
    }

    public function sendContactConfirmation(string $recipient, array $payload): EmailLog
    {
        return $this->send(
            EmailType::CONTACT_SUPPORT,
            $recipient,
            'We received your inquiry — '.$payload['reference_no'],
            'mail.contact-confirmation',
            array_merge($payload, ['subject' => 'We received your inquiry']),
            config('mail.addresses.support'),
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

    private function fromForType(string $type): string
    {
        return match ($type) {
            EmailType::COMPANY_ACTIVATION,
            EmailType::COMPANY_INVITATION,
            EmailType::DRIVER_CREDENTIALS => config('mail.addresses.accounts'),
            EmailType::CONTACT_SUPPORT,
            EmailType::SUPPORT_INQUIRY => config('mail.addresses.support'),
            default => config('mail.addresses.noreply'),
        };
    }

    private function shouldQueue(): bool
    {
        return (bool) config('mail.queue', false)
            && config('queue.default') !== 'sync';
    }
}
