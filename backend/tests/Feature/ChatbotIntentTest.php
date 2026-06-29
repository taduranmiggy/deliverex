<?php

namespace Tests\Feature;

use App\Models\ChatbotIntent;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ChatbotIntentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::query()->create(['name' => 'admin']);
        $this->admin = User::query()->create([
            'role_id' => $role->id,
            'name' => 'Admin User',
            'email' => 'admin@chatbot.test',
            'password' => Hash::make('Password1!'),
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    public function test_admin_can_create_intent(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/chatbot/intents', [
                'name' => 'Track Delivery',
                'description' => 'Track shipments',
                'answer' => 'Enter your Tracking ID to track.',
                'owner' => 'Support',
                'training_phrases' => ['Where is my delivery?', 'Saan ang padala?'],
                'keywords' => ['track' => 3, 'delivery' => 2],
            ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Track Delivery')
            ->assertJsonPath('slug', 'track_delivery');

        $this->assertDatabaseHas('chatbot_intents', [
            'slug' => 'track_delivery',
            'name' => 'Track Delivery',
        ]);
    }

    public function test_create_intent_requires_training_phrases(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/chatbot/intents', [
                'name' => 'Empty Intent',
                'answer' => 'Reply text',
                'training_phrases' => [],
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['training_phrases']);
    }

    public function test_admin_can_delete_intent(): void
    {
        $intent = ChatbotIntent::query()->create([
            'slug' => 'test_intent',
            'name' => 'Test',
            'answer' => 'Test answer',
            'training_phrases' => ['hello'],
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/chatbot/intents/{$intent->id}")
            ->assertOk();

        $this->assertDatabaseMissing('chatbot_intents', ['id' => $intent->id]);
    }
}
