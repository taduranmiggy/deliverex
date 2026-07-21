<?php

namespace Tests\Feature;

use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JobOrderArchiveTest extends TestCase
{
    use RefreshDatabase;

    private User $dispatcher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dispatcher = User::factory()->create([
            'role_id' => Role::create(['name' => 'dispatcher'])->id,
            'email_verified_at' => now(),
        ]);
    }

    public function test_archiving_soft_marks_job_order_as_archived_and_hides_it_from_active_lists(): void
    {
        $jobOrder = JobOrder::create([
            'created_by' => $this->dispatcher->id,
            'tracking_code' => 'ARCH001',
            'customer_name' => 'Archive Client',
            'pickup_street' => 'FEU Institute of Technology',
            'pickup_city' => 'Manila',
            'pickup_province' => 'Metro Manila',
            'pickup_location' => 'FEU Institute of Technology, Manila',
            'dropoff_street' => 'Manila City Hall',
            'dropoff_city' => 'Manila',
            'dropoff_province' => 'Metro Manila',
            'dropoff_location' => 'Manila City Hall, Manila',
            'status' => 'pending',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);

        $response = $this->apiAs($this->dispatcher)->deleteJson('/api/dispatch/job-orders/'.$jobOrder->id);

        $response->assertOk()
            ->assertJsonPath('message', 'Job order archived.');

        $jobOrder->refresh();
        $this->assertTrue((bool) $jobOrder->is_archived);
        $this->assertNotNull($jobOrder->archived_at);
        $this->assertSame('pending', $jobOrder->status);
        $this->assertDatabaseHas('job_orders', [
            'id' => $jobOrder->id,
            'is_archived' => true,
        ]);

        $activeResponse = $this->apiAs($this->dispatcher)->getJson('/api/dispatch/job-orders');
        $activeResponse->assertOk();
        $activeIds = collect($activeResponse->json('data') ?? [])->pluck('id')->all();
        $this->assertNotContains($jobOrder->id, $activeIds);
    }
}
