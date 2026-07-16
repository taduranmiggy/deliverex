<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\DriverLicenseValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverLicenseEligibilityTest extends TestCase
{
    use RefreshDatabase;

    private User $dispatcher;

    protected function setUp(): void
    {
        parent::setUp();

        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        Role::create(['name' => 'driver']);

        $this->dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email_verified_at' => now(),
        ]);
    }

    public function test_missing_license_blocks_assignment(): void
    {
        $driverUser = User::factory()->create(['role_id' => Role::where('name', 'driver')->value('id')]);
        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'full_name' => 'No License',
            'license_no' => null,
            'availability' => 'available',
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'NO-LIC-1',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);

        $jobOrder = $this->createPendingJobOrder();

        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ])->assertStatus(422)
            ->assertJsonPath('message', DriverLicenseValidator::INELIGIBILITY_MESSAGE);
    }

    public function test_expired_license_blocks_assignment(): void
    {
        $driverUser = User::factory()->create(['role_id' => Role::where('name', 'driver')->value('id')]);
        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'full_name' => 'Expired License',
            'license_no' => 'EXP-001',
            'license_expiry' => now()->subDay(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'EXP-001',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);

        $jobOrder = $this->createPendingJobOrder();

        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ])->assertStatus(422)
            ->assertJsonPath('message', DriverLicenseValidator::INELIGIBILITY_MESSAGE);
    }

    private function createPendingJobOrder(): JobOrder
    {
        return JobOrder::create([
            'created_by' => $this->dispatcher->id,
            'tracking_code' => 'TEST'.random_int(1000, 9999),
            'customer_name' => 'Test Client',
            'pickup_location' => 'Pickup Address',
            'dropoff_location' => 'Dropoff Address',
            'status' => 'pending',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(3),
        ]);
    }
}
