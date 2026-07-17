<?php

namespace Tests\Feature;

use App\Models\EmailLog;
use App\Models\Inquiry;
use App\Services\Email\EmailType;
use App\Services\Inquiry\InquiryNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class InquiryNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config([
            'mail.addresses.support' => 'admin@example.com',
            'services.resend.key' => 'test-resend-key',
            'app.frontend_url' => 'https://app.example.com',
        ]);
    }

    public function test_notify_sends_support_and_confirmation_emails(): void
    {
        $inquiry = Inquiry::query()->create([
            'name' => 'Maria Santos',
            'email' => 'maria@example.com',
            'phone' => '+639171234567',
            'inquiry_type' => 'complaint',
            'subject' => 'Late delivery',
            'message' => 'My package arrived two days late.',
            'reference_no' => 'INQ-2026-0009',
            'status' => 'new',
        ]);

        $result = app(InquiryNotificationService::class)->notify($inquiry, 'chatbot');

        $this->assertTrue($result['sent']);
        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::SUPPORT_INQUIRY,
            'recipient' => 'admin@example.com',
            'status' => EmailLog::STATUS_SENT,
        ]);
        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::CONTACT_SUPPORT,
            'recipient' => 'maria@example.com',
            'status' => EmailLog::STATUS_SENT,
        ]);
        Mail::assertSent(\App\Mail\TemplateMail::class, 2);
    }

    public function test_notify_fails_when_support_email_missing(): void
    {
        config(['mail.addresses.support' => '']);

        $inquiry = Inquiry::query()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'inquiry_type' => 'general_question',
            'subject' => 'Help',
            'message' => 'Need help',
            'reference_no' => 'INQ-2026-0010',
            'status' => 'new',
        ]);

        $result = app(InquiryNotificationService::class)->notify($inquiry);

        $this->assertFalse($result['sent']);
        $this->assertStringContainsString('MAIL_SUPPORT_ADDRESS', (string) $result['error']);
    }

    public function test_inquiry_emails_send_synchronously_even_when_queue_enabled(): void
    {
        config([
            'mail.queue' => true,
            'queue.default' => 'database',
        ]);

        $inquiry = Inquiry::query()->create([
            'name' => 'Queue Test',
            'email' => 'queue@example.com',
            'inquiry_type' => 'feedback',
            'subject' => 'Feedback',
            'message' => 'Great service',
            'reference_no' => 'INQ-2026-0011',
            'status' => 'new',
        ]);

        $result = app(InquiryNotificationService::class)->notify($inquiry);

        $this->assertTrue($result['sent']);
        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::SUPPORT_INQUIRY,
            'status' => EmailLog::STATUS_SENT,
        ]);
    }
}
