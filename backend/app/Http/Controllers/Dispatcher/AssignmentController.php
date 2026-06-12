<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\AssignmentAuditTrail;
use App\Models\DeliveryStatusLog;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Assignment\BestFitAssignmentService;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AssignmentScheduleConflict;
use App\Support\AuditLogger;
use App\Support\JobOrderScheduleValidator;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(
        private NotificationDispatcher $notificationDispatcher,
        private BestFitAssignmentService $bestFitAssignmentService
    ) {
    }

    public function index()
    {
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
                ->paginate(20)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'job_order_id'     => 'required|exists:job_orders,id',
            'driver_id'        => 'required|exists:drivers,id',
            'vehicle_id'       => 'required|exists:vehicles,id',
            'override_reason'  => 'nullable|string|max:500',
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

        if ($driver->availability === 'offline' || $driver->status === 'inactive') {
            return response()->json(['message' => 'Driver is offline and cannot be assigned.'], 422);
        }

        if (in_array($vehicle->status, ['maintenance', 'unavailable', 'inactive'], true)) {
            return response()->json(['message' => 'Vehicle is not dispatchable (maintenance or unavailable).'], 422);
        }

        if (AssignmentScheduleConflict::hasDriverConflict($driver->id, $jobOrder)) {
            return response()->json(['message' => 'Driver has a conflicting assignment for this schedule.'], 422);
        }

        if (AssignmentScheduleConflict::hasVehicleConflict($vehicle->id, $jobOrder)) {
            return response()->json(['message' => 'Vehicle has a conflicting assignment for this schedule.'], 422);
        }

        $recommendations = $this->bestFitAssignmentService->recommend($jobOrder);
        $recommended     = $recommendations[0] ?? null;
        $isOverride      = $recommended
            ? ($recommended['driver_id'] !== $driver->id || $recommended['vehicle_id'] !== $vehicle->id)
            : false;

        if ($isOverride && ! trim((string) ($data['override_reason'] ?? ''))) {
            return response()->json([
                'message' => 'Override reason is required when assignment differs from the Best-Fit recommendation.',
            ], 422);
        }

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id'    => $driver->id,
            'vehicle_id'   => $vehicle->id,
            'assigned_by'  => $request->user()?->id,
            'status'       => 'assigned',
            'assigned_at'  => now(),
        ]);

        DeliveryStatusLog::create([
            'assignment_id' => $assignment->id,
            'status'        => 'assigned',
            'notes'         => 'Dispatched via Best-Fit assignment',
            'created_at'    => now(),
        ]);

        $this->applyResourceLocks($driver, $vehicle, $assignment, $jobOrder);

        $jobOrder->update(['status' => 'assigned']);

        $assignment = $assignment->load('jobOrder', 'driver.user', 'vehicle.vehicleType');

        $this->notificationDispatcher->assignmentCreated($assignment);

        $auditTrail = AssignmentAuditTrail::create([
            'assignment_id'             => $assignment->id,
            'job_order_id'              => $jobOrder->id,
            'dispatcher_id'             => $request->user()?->id,
            'recommended_driver_id'     => $recommended ? $recommended['driver_id'] : null,
            'recommended_vehicle_id'    => $recommended ? $recommended['vehicle_id'] : null,
            'recommended_driver_name'   => $recommended ? ($recommended['driver_name'] ?? null) : null,
            'recommended_vehicle_plate' => $recommended ? ($recommended['vehicle_plate'] ?? null) : null,
            'assigned_driver_id'        => $driver->id,
            'assigned_vehicle_id'       => $vehicle->id,
            'assigned_driver_name'      => $driver->full_name ?: ($driver->user?->name ?? 'Driver #'.$driver->id),
            'assigned_vehicle_plate'    => $vehicle->plate_no,
            'is_override'               => $isOverride,
            'override_reason'           => $isOverride ? trim($data['override_reason']) : null,
            'best_fit_score'            => $recommended ? ($recommended['score'] ?? null) : null,
            'best_fit_reasons'          => $recommended ? ($recommended['reasons'] ?? null) : null,
        ]);

        AuditLogger::record($request->user(), 'dispatch.assignment_created', DispatchAssignment::class, $assignment->id, [
            'job_order_id'      => $jobOrder->id,
            'driver_id'         => $driver->id,
            'vehicle_id'        => $vehicle->id,
            'recommended'       => $recommended,
            'override'          => $isOverride,
            'override_reason'   => $auditTrail->override_reason,
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
