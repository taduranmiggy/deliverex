<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\AssignmentAuditTrail;
use App\Models\DeliveryStatusHistory;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Assignment\DispatchResourceService;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AssignmentScheduleConflict;
use App\Support\AuditLogger;
use App\Support\DeliveryStatus;
use App\Support\JobOrderScheduleValidator;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(
        private NotificationDispatcher $notificationDispatcher,
        private DispatchResourceService $dispatchResourceService
    ) {
    }

    public function index(Request $request)
    {
        $perPage = max(1, min(100, (int) $request->query('per_page', 6)));

        return response()->json(
            DispatchAssignment::with([
                'jobOrder',
                'driver.user',
                'vehicle.vehicleType',
                'latestDelayReport',
                'latestArrivedStatusLog',
                'deliveryDocuments' => fn ($q) => $q->where('type', 'departure'),
            ])
                ->latest()
                ->paginate($perPage)
        );
    }

    public function options(JobOrder $jobOrder)
    {
        return response()->json([
            'job_order_id' => $jobOrder->id,
            'options' => $this->dispatchResourceService->optionsForJob($jobOrder),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'job_order_id'     => 'required|exists:job_orders,id',
            'driver_id'        => 'required|exists:drivers,id',
            'vehicle_id'       => 'required|exists:vehicles,id',
        ]);

        $driver   = Driver::with('user')->findOrFail($data['driver_id']);
        $vehicle  = Vehicle::findOrFail($data['vehicle_id']);
        $jobOrder = JobOrder::findOrFail($data['job_order_id']);

        try {
            JobOrderScheduleValidator::validateJobOrder($jobOrder);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => JobOrderScheduleValidator::MESSAGE,
                'errors'  => $e->errors(),
            ], 422);
        }

        if ($jobOrder->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending job orders can be assigned. Current status: '.$jobOrder->status,
            ], 422);
        }

        $activeOnJob = DispatchAssignment::where('job_order_id', $jobOrder->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->exists();

        if ($activeOnJob) {
            return response()->json(['message' => 'This job order already has an active assignment.'], 422);
        }

        if ($driver->status === 'inactive' || $driver->availability === 'offline') {
            return response()->json(['message' => 'Driver is offline and cannot be assigned.'], 422);
        }

        if ($driver->availability !== null && $driver->availability !== 'available') {
            return response()->json(['message' => 'Driver must be available before assignment.'], 422);
        }

        if (! $driver->user_id) {
            return response()->json([
                'message' => 'Driver has no login account. Admin must Generate Account in Master Data.',
            ], 422);
        }

        if (in_array($vehicle->status, ['maintenance', 'unavailable', 'inactive'], true)) {
            return response()->json(['message' => 'Vehicle is not dispatchable (maintenance or unavailable).'], 422);
        }

        if ($vehicle->status !== null && $vehicle->status !== 'available') {
            return response()->json(['message' => 'Vehicle must be available before assignment.'], 422);
        }

        if (AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder)) {
            return response()->json(['message' => 'Driver has a conflicting assignment for this schedule.'], 422);
        }

        if (AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder)) {
            return response()->json(['message' => 'Vehicle has a conflicting assignment for this schedule.'], 422);
        }

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id'    => $driver->id,
            'vehicle_id'   => $vehicle->id,
            'assigned_by'  => $request->user()?->id,
            'status'       => DeliveryStatus::ASSIGNED,
            'assigned_at'  => now(),
        ]);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status'        => DeliveryStatus::ASSIGNED,
            'notes'         => 'Dispatched by dispatcher',
            'created_at'    => now(),
        ]);

        DeliveryStatusHistory::create([
            'job_order_id' => $assignment->job_order_id,
            'assignment_id' => $assignment->id,
            'status' => DeliveryStatus::ASSIGNED,
            'updated_by' => $request->user()?->id,
            'updated_at' => now(),
            'remarks' => 'Dispatched by dispatcher',
            'created_at' => now(),
        ]);

        $this->applyResourceLocks($driver, $vehicle, $assignment, $jobOrder);

        $jobOrder->update(['status' => DeliveryStatus::toJobOrderStatus(DeliveryStatus::ASSIGNED)]);

        $assignment = $assignment->load('jobOrder', 'driver.user', 'vehicle.vehicleType');

        $this->notificationDispatcher->assignmentCreated($assignment);

        $auditTrail = AssignmentAuditTrail::create([
            'assignment_id'             => $assignment->id,
            'job_order_id'              => $jobOrder->id,
            'dispatcher_id'             => $request->user()?->id,
            'recommended_driver_id'     => null,
            'recommended_vehicle_id'    => null,
            'recommended_driver_name'   => null,
            'recommended_vehicle_plate' => null,
            'assigned_driver_id'        => $driver->id,
            'assigned_vehicle_id'       => $vehicle->id,
            'assigned_driver_name'      => $driver->full_name ?: ($driver->user?->name ?? 'Driver #'.$driver->id),
            'assigned_vehicle_plate'    => $vehicle->plate_no,
            'is_override'               => false,
            'override_reason'           => null,
            'best_fit_score'            => null,
            'best_fit_reasons'          => null,
        ]);

        AuditLogger::record($request->user(), 'dispatch.assignment_created', DispatchAssignment::class, $assignment->id, [
            'job_order_id'      => $jobOrder->id,
            'driver_id'         => $driver->id,
            'vehicle_id'        => $vehicle->id,
            'audit_trail_id'    => $auditTrail->id,
        ], $request);

        return response()->json($assignment, 201);
    }

    /**
     * Lock driver/vehicle only when the job is active now or has no future schedule.
     */
    private function applyResourceLocks(Driver $driver, Vehicle $vehicle, DispatchAssignment $assignment, JobOrder $jobOrder): void
    {
        $startsSoon = ! $jobOrder->scheduled_start
            || $jobOrder->scheduled_start->lte(now()->addHour());

        if ($startsSoon) {
            $driver->update([
                'availability'          => 'busy',
                'current_assignment_id' => $assignment->id,
            ]);
            $vehicle->update(['status' => 'assigned']);
        }
    }
}
