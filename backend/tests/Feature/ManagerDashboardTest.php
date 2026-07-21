<?php

namespace Tests\Feature;

use App\Models\AssignmentAuditTrail;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManagerDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_dashboard_returns_performance_kpis(): void
    {
        $managerRole = Role::create(['name' => 'manager']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $driverRole = Role::create(['name' => 'driver']);

        $manager = User::factory()->create([
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
        ]);

        $dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email_verified_at' => now(),
        ]);

        $driverUser = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
        ]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'license_no' => 'LIC-TEST-01',
            'availability' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'TEST-001',
            'type' => 'Cargo Van',
            'capacity' => '3T',
            'status' => 'available',
        ]);

        $scheduledEnd = now()->addDays(2);
        $startedAt = now()->subHour();
        $completedAt = now()->subMinutes(30);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'status' => 'completed',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => $scheduledEnd,
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => 'completed',
            'assigned_at' => $startedAt->copy()->subHours(2),
            'started_at' => $startedAt,
            'completed_at' => $completedAt,
            'pod_verified_at' => $completedAt->copy()->addMinutes(10),
            'pod_verified_by' => $dispatcher->id,
        ]);

        AssignmentAuditTrail::create([
            'assignment_id' => $assignment->id,
            'job_order_id' => $jobOrder->id,
            'dispatcher_id' => $dispatcher->id,
            'assigned_driver_id' => $driver->id,
            'assigned_vehicle_id' => $vehicle->id,
            'assigned_driver_name' => $driverUser->name,
            'assigned_vehicle_plate' => $vehicle->plate_no,
            'is_override' => false,
            'best_fit_score' => 88.5,
        ]);

        $response = $this->apiAs($manager)
            ->getJson('/api/manager/dashboard');

        $response->assertOk();
        $response->assertJsonStructure([
            'on_time_pct',
            'delivery_completion_pct',
            'avg_delivery_time_hours',
            'driver_utilization_pct',
            'pod_completion_pct',
            'exception_rate_pct',
            'period' => ['from', 'to'],
        ]);

        $response->assertJsonPath('on_time_pct', 100);
        $response->assertJsonPath('delivery_completion_pct', 100);
        $response->assertJsonPath('pod_completion_pct', 100);
        $response->assertJsonPath('exception_rate_pct', 0);
        $response->assertJsonPath('driver_utilization_pct', 100);
        $response->assertJsonPath('best_fit_efficiency_score', 88.5);
        $this->assertNotNull($response->json('avg_delivery_time_hours'));
        $this->assertIsArray($response->json('on_time_pct_trend'));
    }

    public function test_manager_dashboard_defaults_to_ninety_day_period(): void
    {
        $managerRole = Role::create(['name' => 'manager']);
        $manager = User::factory()->create([
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
        ]);

        $response = $this->apiAs($manager)
            ->getJson('/api/manager/dashboard');

        $response->assertOk();
        $this->assertSame(now()->subDays(90)->startOfDay()->toDateString(), $response->json('period.from'));
    }

    public function test_manager_can_read_ocr_review_queue(): void
    {
        $managerRole = Role::create(['name' => 'manager']);
        $manager = User::factory()->create([
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($manager, 'sanctum')
            ->getJson('/api/ocr/review');

        $response->assertOk();
    }
}
