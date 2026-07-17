<?php

namespace App\Services\Inquiry;

use App\Models\Inquiry;
use App\Services\Email\EmailService;
use Illuminate\Support\Facades\Log;
use Throwable;

class InquiryNotificationService
{
    public function __construct(private readonly EmailService $email)
    {
    }

    /**
     * Notify the configured support inbox and send customer confirmation.
     *
     * @return array{sent: bool, support_log_id: int|null, confirmation_log_id: int|null, error: string|null}
     */
    public function notify(Inquiry $inquiry, string $source = 'form'): array
    {
        $context = [
            'inquiry_id' => $inquiry->id,
            'reference_no' => $inquiry->reference_no,
            'source' => $source,
        ];

        Log::info('Inquiry received — preparing notification emails', $context);

        try {
            $this->assertMailConfiguration();

            $payload = $this->buildPayload($inquiry, $source);

            Log::info('Inquiry saved — sending support notification', array_merge($context, [
                'support_recipient' => config('mail.addresses.support'),
                'customer_email' => $inquiry->email,
            ]));

            $supportLog = $this->email->sendSupportInquiry($payload);

            Log::info('Support inquiry email dispatched', array_merge($context, [
                'email_log_id' => $supportLog->id,
                'status' => $supportLog->status,
                'recipient' => $supportLog->recipient,
            ]));

            $confirmationLog = $this->email->sendContactConfirmation($inquiry->email, $payload);

            Log::info('Customer confirmation email dispatched', array_merge($context, [
                'email_log_id' => $confirmationLog->id,
                'status' => $confirmationLog->status,
                'recipient' => $confirmationLog->recipient,
            ]));

            return [
                'sent' => true,
                'support_log_id' => $supportLog->id,
                'confirmation_log_id' => $confirmationLog->id,
                'error' => null,
            ];
        } catch (Throwable $e) {
            Log::error('Inquiry notification email failed', array_merge($context, [
                'error' => $e->getMessage(),
            ]));

            return [
                'sent' => false,
                'support_log_id' => null,
                'confirmation_log_id' => null,
                'error' => $e->getMessage(),
            ];
        }
    }

    private function assertMailConfiguration(): void
    {
        $support = strtolower(trim((string) config('mail.addresses.support', '')));
        if ($support === '' || ! filter_var($support, FILTER_VALIDATE_EMAIL)) {
            throw new \RuntimeException('Support email is not configured. Set MAIL_SUPPORT_ADDRESS in the environment.');
        }

        if (config('mail.default') === 'resend' && empty(config('services.resend.key'))) {
            throw new \RuntimeException('RESEND_API_KEY is not configured. Inquiry emails cannot be sent.');
        }
    }

    /** @return array<string, mixed> */
    private function buildPayload(Inquiry $inquiry, string $source): array
    {
        $timezone = config('app.timezone', 'UTC');

        return [
            'reference_no' => $inquiry->reference_no,
            'inquiry_id' => $inquiry->id,
            'name' => $inquiry->name,
            'email' => $inquiry->email,
            'phone' => $inquiry->phone,
            'inquiry_type' => $inquiry->inquiry_type,
            'inquiry_type_label' => $this->typeLabel($inquiry->inquiry_type),
            'priority' => $this->priorityForType($inquiry->inquiry_type),
            'subject_line' => $inquiry->subject,
            'message_body' => $inquiry->message,
            'submitted_at' => $inquiry->created_at
                ? $inquiry->created_at->timezone($timezone)->format('M j, Y g:i A T')
                : now()->timezone($timezone)->format('M j, Y g:i A T'),
            'source' => $source,
            'admin_url' => $this->adminViewUrl($inquiry),
        ];
    }

    private function typeLabel(?string $type): string
    {
        return match ($type) {
            'delivery_inquiry' => 'Delivery concern',
            'complaint' => 'Complaint',
            'follow_up' => 'Follow-up',
            'feedback' => 'Feedback',
            'general_question' => 'General question',
            default => 'Customer concern',
        };
    }

    private function priorityForType(?string $type): string
    {
        return match ($type) {
            'complaint' => 'High',
            'delivery_inquiry' => 'Medium',
            'follow_up' => 'Medium',
            'feedback' => 'Low',
            default => 'Normal',
        };
    }

    private function adminViewUrl(Inquiry $inquiry): string
    {
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $path = trim((string) config('mail.inquiry.admin_path', '/admin/inquiries'), '/');

        return "{$base}/{$path}?ref={$inquiry->reference_no}";
    }
}
