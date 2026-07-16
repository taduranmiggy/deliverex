<?php

namespace Tests\Feature;

use App\Models\DeliveryCompletionProof;
use App\Models\DeliveryStatusHistory;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\DriverAvailabilityLog;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Driver\DriverAvailabilityService;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DriverAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private User $dispatcher;

    private User $driverUser;

    private Driver $driver;

    private Vehicle $vehicle;

    protected function setUp(): void
    {
        parent::setUp();

        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $driverRole = Role::create(['name' => 'driver']);

        $this->dispatcher = User::factory()->create([
            'role_id' => $dispatcherRole->id,
            'email_verified_at' => now(),
        ]);

        $this->driverUser = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
        ]);

        $this->driver = Driver::create([
            'user_id' => $this->driverUser->id,
            'full_name' => 'Test Driver',
            'license_no' => 'LIC-001',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);

        $this->vehicle = Vehicle::create([
            'plate_no' => 'ABC-1234',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);
    }

    public function test_scenario_a_assignment_marks_driver_and_vehicle_busy(): void
    {
        $jobOrder = $this->createPendingJobOrder();

        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])->assertCreated();

        $this->driver->refresh();
        $this->vehicle->refresh();

        $this->assertSame('busy', $this->driver->availability);
        $this->assertSame('assigned', $this->vehicle->status);
    }

    public function test_scenario_b_complete_delivery_frees_driver_and_vehicle(): void
    {
        $assignment = $this->assignDriverToJob(DeliveryStatus::ARRIVED_AT_DESTINATION);

        Storage::fake('public');
        $this->apiAs($this->driverUser)->postJson('/api/driver/completion-proof', [
            'assignment_id' => $assignment->id,
            'proof_type' => DeliveryCompletionProof::TYPE_RECEIPT_PHOTO,
            'receiver_name' => 'Receiver',
            'file' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertCreated();

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::COMPLETED,
        ])->assertOk();

        $this->driver->refresh();
        $this->vehicle->refresh();

        $this->assertSame('available', $this->driver->availability);
        $this->assertNull($this->driver->current_assignment_id);
        $this->assertSame('available', $this->vehicle->status);
    }

    public function test_scenario_c_cancel_assignment_frees_driver_and_vehicle(): void
    {
        $assignment = $this->assignDriverToJob(DeliveryStatus::EN_ROUTE_TO_PICKUP);

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::CANCELLED,
        ])->assertOk();

        $this->driver->refresh();
        $this->vehicle->refresh();

        $this->assertSame('available', $this->driver->availability);
        $this->assertSame('available', $this->vehicle->status);
    }

    public function test_scenario_d_rejects_second_assignment_for_busy_driver(): void
    {
        $firstJob = $this->createPendingJobOrder();
        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $firstJob->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])->assertCreated();

        $secondVehicle = Vehicle::create([
            'plate_no' => 'SEC-9999',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);

        $secondJob = $this->createPendingJobOrder(now()->addDays(3), now()->addDays(3)->addHours(4));
        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $secondJob->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $secondVehicle->id,
            'override_reason' => 'Attempt duplicate assignment',
        ])->assertStatus(422);
    }

    public function test_vehicle_enters_in_operation_when_trip_starts(): void
    {
        $assignment = $this->assignDriverToJob(DeliveryStatus::ASSIGNED);
        $this->vehicle->update(['status' => 'assigned']);

        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::EN_ROUTE_TO_PICKUP,
            'latitude' => 14.5995,
            'longitude' => 121.0364,
        ])->assertOk();

        $this->assertSame('in_operation', $this->vehicle->fresh()->status);
    }

    public function test_scenario_e_all_completed_jobs_return_resources_to_available(): void
    {
        $assignment = $this->assignDriverToJob(DeliveryStatus::COMPLETED, persistStale: true);

        app(\App\Services\Fleet\AssignmentResourceSyncService::class)->reconcileAll('thesis_defense_cleanup');

        $this->driver->refresh();
        $this->vehicle->refresh();

        $this->assertSame('available', $this->driver->availability);
        $this->assertSame('available', $this->vehicle->status);
        $this->assertNull($this->driver->current_assignment_id);
    }

    public function test_scenario_d_reassignment_frees_old_driver_and_busy_new_driver(): void
    {
        $driverRole = Role::where('name', 'driver')->first();
        $secondUser = User::factory()->create([
            'role_id' => $driverRole->id,
            'email_verified_at' => now(),
        ]);
        $secondDriver = Driver::create([
            'user_id' => $secondUser->id,
            'full_name' => 'Second Driver',
            'license_no' => 'LIC-002',
            'license_expiry' => now()->addYear(),
            'availability' => 'available',
            'status' => 'available',
        ]);
        $secondVehicle = Vehicle::create([
            'plate_no' => 'XYZ-5678',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);

        $firstJob = $this->createPendingJobOrder();
        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $firstJob->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])->assertCreated();

        $this->driver->refresh();
        $this->assertSame('busy', $this->driver->availability);

        $assignment = DispatchAssignment::where('job_order_id', $firstJob->id)->firstOrFail();
        $this->apiAs($this->driverUser)->postJson('/api/driver/status', [
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::CANCELLED,
        ])->assertOk();

        $this->driver->refresh();
        $this->assertSame('available', $this->driver->availability);

        $secondJob = $this->createPendingJobOrder(now()->addDay(), now()->addDay()->addHours(4));
        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $secondJob->id,
            'driver_id' => $secondDriver->id,
            'vehicle_id' => $secondVehicle->id,
            'override_reason' => 'Reassigning after first driver cancellation',
        ])->assertCreated();

        $secondDriver->refresh();
        $this->assertSame('busy', $secondDriver->availability);
        $this->assertSame('available', $this->driver->fresh()->availability);
    }

    public function test_scenario_e_availability_correct_after_reconcile_simulating_restart(): void
    {
        $assignment = $this->assignDriverToJob(DeliveryStatus::COMPLETED, persistStale: true);

        $this->driver->update([
            'availability' => 'busy',
            'current_assignment_id' => $assignment->id,
        ]);
        $this->vehicle->update(['status' => 'in_operation']);

        app(\App\Services\Fleet\AssignmentResourceSyncService::class)->reconcileAll('system_restart');

        $this->driver->refresh();
        $this->vehicle->refresh();
        $this->assertSame('available', $this->driver->availability);
        $this->assertNull($this->driver->current_assignment_id);
        $this->assertSame('available', $this->vehicle->status);
    }

    public function test_scenario_f_job_order_cancel_clears_stale_busy_flag(): void
    {
        $jobOrder = $this->createPendingJobOrder();
        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => DeliveryStatus::ASSIGNED,
            'assigned_at' => now(),
        ]);

        $jobOrder->update(['status' => DeliveryStatus::toJobOrderStatus(DeliveryStatus::ASSIGNED)]);
        $this->driver->update([
            'availability' => 'busy',
            'current_assignment_id' => $assignment->id,
        ]);

        $this->apiAs($this->dispatcher)->putJson('/api/dispatch/job-orders/'.$jobOrder->id, [
            'status' => 'cancelled',
        ])->assertOk();

        $assignment->refresh();
        $this->driver->refresh();

        $this->assertSame(DeliveryStatus::CANCELLED, $assignment->status);
        $this->assertSame('available', $this->driver->availability);
        $this->assertNull($this->driver->current_assignment_id);
        $this->assertSame('available', $this->vehicle->fresh()->status);
    }

    public function test_future_scheduled_assignment_marks_driver_busy(): void
    {
        $jobOrder = $this->createPendingJobOrder(now()->addDays(2), now()->addDays(2)->addHours(4));

        $this->apiAs($this->dispatcher)->postJson('/api/dispatch/assignments', [
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])->assertCreated();

        $this->driver->refresh();
        $this->assertSame('busy', $this->driver->availability);
    }

    public function test_reconcile_cancels_duplicate_active_assignments_on_same_job(): void
    {
        $jobOrder = $this->createPendingJobOrder();

        $older = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => DeliveryStatus::ASSIGNED,
            'assigned_at' => now()->subHour(),
        ]);

        $newer = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => DeliveryStatus::ASSIGNED,
            'assigned_at' => now(),
        ]);

        app(\App\Services\Fleet\AssignmentResourceSyncService::class)->reconcileAll('duplicate_cleanup');

        $this->assertSame(DeliveryStatus::CANCELLED, $older->fresh()->status);
        $this->assertSame(DeliveryStatus::ASSIGNED, $newer->fresh()->status);
    }

    private function createPendingJobOrder(?\DateTimeInterface $start = null, ?\DateTimeInterface $end = null): JobOrder
    {
        return JobOrder::factory()->create([
            'created_by' => $this->dispatcher->id,
            'status' => 'pending',
            'scheduled_start' => $start ?? now()->addHour(),
            'scheduled_end' => $end ?? now()->addHours(3),
        ]);
    }

    private function assignDriverToJob(string $status, bool $persistStale = false): DispatchAssignment
    {
        $jobOrder = $this->createPendingJobOrder();
        $jobOrder->update(['status' => DeliveryStatus::toJobOrderStatus($status)]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
            'assigned_by' => $this->dispatcher->id,
            'status' => $status,
            'assigned_at' => now(),
            'started_at' => $status !== DeliveryStatus::ASSIGNED ? now() : null,
        ]);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ASSIGNED,
            'notes' => 'Test assignment',
            'created_at' => now(),
        ]);

        DeliveryStatusHistory::create([
            'job_order_id' => $jobOrder->id,
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ASSIGNED,
            'updated_by' => $this->dispatcher->id,
            'updated_at' => now(),
            'remarks' => 'Test assignment',
            'created_at' => now(),
        ]);

        if ($persistStale) {
            $this->driver->update([
                'availability' => 'busy',
                'current_assignment_id' => $assignment->id,
            ]);
            $this->vehicle->update(['status' => 'assigned']);
        } else {
            app(\App\Services\Fleet\AssignmentResourceSyncService::class)
                ->syncForAssignment($assignment, 'test_setup');
        }

        return $assignment;
    }
}
