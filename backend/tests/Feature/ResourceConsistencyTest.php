<?php

namespace Tests\Feature;

use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Fleet\ResourceConsistencyService;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ResourceConsistencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_consistency_report_detects_stale_driver_and_vehicle_flags(): void
    {
        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $driverRole = Role::create(['name' => 'driver']);
        $adminRole = Role::create(['name' => 'admin']);

        $dispatcher = User::factory()->create(['role_id' => $dispatcherRole->id, 'email_verified_at' => now()]);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'email_verified_at' => now()]);
        $driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'full_name' => 'Stale Driver',
            'license_no' => 'LIC-STALE',
            'availability' => 'busy',
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'STALE-1',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'assigned',
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'status' => DeliveryStatus::COMPLETED,
        ]);

        DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => DeliveryStatus::COMPLETED,
            'assigned_at' => now()->subDay(),
            'completed_at' => now()->subHour(),
        ]);

        $report = app(ResourceConsistencyService::class)->report();

        $this->assertGreaterThan(0, $report['issue_count']);
        $types = collect($report['issues'])->pluck('type')->all();
        $this->assertContains('driver_availability_drift', $types);
        $this->assertContains('vehicle_status_drift', $types);

        $response = $this->apiAs($admin)->getJson('/api/admin/fleet/consistency');
        $response->assertOk()->assertJsonStructure(['checked_at', 'issue_count', 'issues']);
    }
}
