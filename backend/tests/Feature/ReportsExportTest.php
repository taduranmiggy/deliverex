<?php

namespace Tests\Feature;

use App\Models\AssignmentAuditTrail;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\DeliveryStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReportsExportTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $managerRole = Role::create(['name' => 'manager']);
        $dispatcherRole = Role::create(['name' => 'dispatcher']);
        $driverRole = Role::create(['name' => 'driver']);

        $this->manager = User::factory()->create([
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        $dispatcher = User::factory()->create(['role_id' => $dispatcherRole->id, 'email_verified_at' => now()]);
        $driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'license_no' => 'RPT-LIC',
            'availability' => 'available',
            'status' => 'active',
            'full_name' => 'Report Driver',
        ]);

        $vehicle = Vehicle::create([
            'plate_no' => 'RPT-001',
            'type' => 'Dump Truck',
            'capacity' => '10T',
            'status' => 'available',
        ]);

        $company = Company::create([
            'company_name' => 'Report Co',
            'company_email' => 'reportco@test.com',
            'status' => Company::STATUS_ACTIVE,
            'created_by' => $dispatcher->id,
        ]);

        $jobOrder = JobOrder::factory()->create([
            'created_by' => $dispatcher->id,
            'company_id' => $company->id,
            'customer_name' => 'Report Client',
            'status' => 'completed',
        ]);

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $dispatcher->id,
            'status' => DeliveryStatus::COMPLETED,
            'assigned_at' => now()->subDay(),
            'completed_at' => now(),
        ]);

        AssignmentAuditTrail::create([
            'assignment_id' => $assignment->id,
            'job_order_id' => $jobOrder->id,
            'dispatcher_id' => $dispatcher->id,
            'assigned_driver_id' => $driver->id,
            'assigned_vehicle_id' => $vehicle->id,
            'assigned_driver_name' => 'Report Driver',
            'assigned_vehicle_plate' => 'RPT-001',
            'is_override' => false,
        ]);
    }

    public function test_scenario_a_job_order_report_lists_deliveries(): void
    {
        $this->apiAs($this->manager)->getJson('/api/manager/reports')
            ->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_scenario_b_date_range_filter(): void
    {
        $from = now()->subDays(2)->toDateString();
        $to = now()->toDateString();

        $this->apiAs($this->manager)->getJson("/api/manager/reports?from={$from}&to={$to}&date_field=assigned_at")
            ->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_scenario_c_export_pdf(): void
    {
        $response = $this->apiAs($this->manager)->get('/api/manager/reports/export?type=deliveries&format=pdf');

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('Content-Type'));
    }

    public function test_scenario_d_export_excel_is_rejected(): void
    {
        $this->apiAs($this->manager)->get('/api/manager/reports/export?type=deliveries&format=xlsx')
            ->assertStatus(422);
    }

    public function test_scenario_e_export_csv_is_rejected(): void
    {
        $this->apiAs($this->manager)->get('/api/manager/reports/export?type=deliveries&format=csv')
            ->assertStatus(422);
    }

    public function test_scenario_f_export_is_manager_only(): void
    {
        $driverRole = Role::where('name', 'driver')->first();
        $driverUser = User::factory()->create(['role_id' => $driverRole->id, 'email_verified_at' => now()]);

        $this->apiAs($driverUser)->get('/api/manager/reports/export?type=deliveries&format=pdf')
            ->assertForbidden();
    }

    public function test_export_logs_audit_entry(): void
    {
        $this->apiAs($this->manager)->get('/api/manager/reports/export?type=assignment_audit&format=pdf')->assertOk();

        $this->assertTrue(
            AuditLog::query()->where('action', 'reports.export_pdf')->exists()
        );
    }
}
