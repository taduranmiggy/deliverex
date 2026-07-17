<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\EmailLog;
use App\Models\Role;
use App\Models\User;
use App\Services\Email\EmailService;
use App\Services\Email\EmailType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EmailServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin']);
        Role::firstOrCreate(['name' => 'driver']);
        Mail::fake();
    }

    public function test_company_activation_creates_email_log(): void
    {
        $company = Company::query()->create([
            'company_name' => 'Test Co',
            'company_email' => 'owner@example.com',
            'status' => Company::STATUS_PENDING,
        ]);

        app(EmailService::class)->sendCompanyActivation($company, 'https://deliverexapp.com/activate-company/token');

        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::COMPANY_ACTIVATION,
            'recipient' => 'owner@example.com',
            'status' => EmailLog::STATUS_SENT,
        ]);

        Mail::assertSent(\App\Mail\TemplateMail::class);
    }

    public function test_password_reset_email(): void
    {
        $role = Role::where('name', 'admin')->first();
        $user = User::factory()->create(['email' => 'user@example.com', 'role_id' => $role->id]);

        app(EmailService::class)->sendPasswordReset($user, 'https://deliverexapp.com/reset-password?token=abc');

        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::PASSWORD_RESET,
            'recipient' => 'user@example.com',
        ]);
    }

    public function test_driver_credentials_email(): void
    {
        $role = Role::where('name', 'driver')->first();
        $user = User::factory()->create(['email' => 'driver@deliverex.driver', 'role_id' => $role->id]);

        app(EmailService::class)->sendDriverCredentials($user, 'DRV-TEST12');

        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::DRIVER_CREDENTIALS,
            'recipient' => 'driver@deliverex.driver',
        ]);
    }

    public function test_support_inquiry_email(): void
    {
        config(['services.resend.key' => 'test-resend-key']);

        app(EmailService::class)->sendSupportInquiry([
            'reference_no' => 'INQ-2026-0001',
            'inquiry_id' => 1,
            'name' => 'Jane',
            'email' => 'jane@example.com',
            'phone' => '09171234567',
            'inquiry_type' => 'general_question',
            'inquiry_type_label' => 'General question',
            'priority' => 'Normal',
            'subject_line' => 'Help',
            'message_body' => 'Need assistance',
            'submitted_at' => 'Jul 18, 2026 2:00 AM UTC',
            'source' => 'form',
            'admin_url' => 'https://app.example.com/admin/inquiries?ref=INQ-2026-0001',
        ]);

        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::SUPPORT_INQUIRY,
            'recipient' => config('mail.addresses.support'),
        ]);
    }

    public function test_delivery_notification_email(): void
    {
        app(EmailService::class)->sendDeliveryNotification(
            EmailType::DELIVERY_ASSIGNED,
            'customer@example.com',
            'Delivery assigned — ABC123',
            [
                'trackingCode' => 'ABC123',
                'customerName' => 'Customer',
                'trackingUrl' => 'https://deliverexapp.com/track/ABC123',
            ],
        );

        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::DELIVERY_ASSIGNED,
            'recipient' => 'customer@example.com',
        ]);
    }

    public function test_company_activation_retry_renders_from_stored_metadata(): void
    {
        $company = Company::query()->create([
            'company_name' => 'Retry Co',
            'company_email' => 'retry@example.com',
            'contact_person' => 'Retry Person',
            'status' => Company::STATUS_PENDING,
        ]);

        $log = EmailLog::query()->create([
            'email_type' => EmailType::COMPANY_ACTIVATION,
            'recipient' => 'retry@example.com',
            'subject' => 'Activate',
            'from_address' => 'accounts@deliverexapp.com',
            'status' => EmailLog::STATUS_FAILED,
            'provider' => 'resend',
            'company_id' => $company->id,
            'metadata' => [
                'view' => 'mail.company-activation',
                'view_data' => [
                    'company' => $company->toArray(),
                    'activationUrl' => 'https://deliverexapp.com/activate-company/token',
                    'subject' => 'Activate',
                ],
            ],
        ]);

        app(EmailService::class)->retry($log);

        $this->assertDatabaseHas('email_logs', [
            'id' => $log->id,
            'status' => EmailLog::STATUS_SENT,
        ]);

        Mail::assertSent(\App\Mail\TemplateMail::class);
    }
}
