<?php

namespace Tests\Feature;

use App\Models\EmailLog;
use App\Models\Inquiry;
use App\Models\JobOrder;
use App\Services\Email\EmailType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ChatbotTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config([
            'mail.addresses.support' => 'support@example.com',
            'services.resend.key' => 'test-resend-key',
        ]);
    }

    public function test_welcome_returns_capabilities(): void
    {
        $response = $this->getJson('/api/chatbot/welcome');

        $response->assertOk()
            ->assertJsonStructure(['messages', 'suggestions', 'state'])
            ->assertJsonPath('state.mode', null);

        $text = $response->json('messages.0.body');
        $this->assertStringContainsString('Deliverex Assistant', $text);
    }

    public function test_knowledge_question_about_best_fit(): void
    {
        $response = $this->postJson('/api/chatbot/message', [
            'message' => 'What is Best-Fit assignment?',
        ]);

        $response->assertOk();
        $body = $response->json('messages.0.body');
        $this->assertStringContainsString('Best-Fit', $body);
        $this->assertStringContainsString('100', $body);
    }

    public function test_tracking_code_in_message_looks_up_delivery(): void
    {
        $job = JobOrder::factory()->create([
            'tracking_code' => 'TRK-CHATBOT1',
            'status' => 'pending',
        ]);

        $response = $this->postJson('/api/chatbot/message', [
            'message' => 'Where is TRK-CHATBOT1?',
        ]);

        $response->assertOk()
            ->assertJsonPath('messages.0.type', 'tracking')
            ->assertJsonPath('messages.0.body.code', $job->tracking_code);
    }

    public function test_inquiry_flow_creates_record_on_confirm(): void
    {
        $start = $this->postJson('/api/chatbot/message', [
            'message' => 'Submit a concern',
            'state' => [],
        ]);
        $start->assertOk();
        $state = $start->json('state');

        $withMessage = $this->postJson('/api/chatbot/message', [
            'message' => 'My delivery was late and the driver did not call.',
            'state' => $state,
        ]);
        $withMessage->assertOk();
        $state = $withMessage->json('state');

        $withName = $this->postJson('/api/chatbot/message', [
            'message' => 'Juan Dela Cruz',
            'state' => $state,
        ]);
        $state = $withName->json('state');

        $withEmail = $this->postJson('/api/chatbot/message', [
            'message' => 'juan@example.com',
            'state' => $state,
        ]);
        $state = $withEmail->json('state');

        $withPhone = $this->postJson('/api/chatbot/message', [
            'message' => 'skip',
            'state' => $state,
        ]);
        $state = $withPhone->json('state');
        $this->assertSame('confirm', $state['inquiry_step'] ?? null);

        $submit = $this->postJson('/api/chatbot/message', [
            'message' => 'yes',
            'state' => $state,
        ]);

        $submit->assertOk()
            ->assertJsonPath('messages.0.type', 'inquiry_submitted')
            ->assertJsonPath('email_notification_sent', true);

        $this->assertDatabaseHas('inquiries', [
            'email' => 'juan@example.com',
            'name' => 'Juan Dela Cruz',
        ]);

        $inquiry = Inquiry::query()->where('email', 'juan@example.com')->first();
        $this->assertNotNull($inquiry->reference_no);

        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::SUPPORT_INQUIRY,
            'recipient' => 'support@example.com',
            'status' => EmailLog::STATUS_SENT,
        ]);

        $this->assertDatabaseHas('email_logs', [
            'email_type' => EmailType::CONTACT_SUPPORT,
            'recipient' => 'juan@example.com',
            'status' => EmailLog::STATUS_SENT,
        ]);

        Mail::assertSent(\App\Mail\TemplateMail::class, 2);
    }

    public function test_tagalog_tracking_intent_starts_tracking_mode(): void
    {
        $response = $this->postJson('/api/chatbot/message', [
            'message' => 'Paano mag-track ng padala?',
        ]);

        $response->assertOk()
            ->assertJsonPath('state.mode', 'tracking');
    }
}
