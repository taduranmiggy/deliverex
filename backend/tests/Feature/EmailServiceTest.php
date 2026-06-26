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
        app(EmailService::class)->sendSupportInquiry([
            'reference_no' => 'INQ-2026-0001',
            'name' => 'Jane',
            'email' => 'jane@example.com',
            'phone' => '09171234567',
            'inquiry_type' => 'general_question',
            'subject_line' => 'Help',
            'message_body' => 'Need assistance',
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
}
