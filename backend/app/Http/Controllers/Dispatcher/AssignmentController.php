<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(private NotificationDispatcher $notificationDispatcher)
    {
    }

    public function index()
    {
        return response()->json(
            DispatchAssignment::with('jobOrder', 'driver.user', 'vehicle')
                ->latest()
                ->paginate(20)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'job_order_id' => 'required|exists:job_orders,id',
            'driver_id' => 'required|exists:drivers,id',
            'vehicle_id' => 'required|exists:vehicles,id',
        ]);

        $driver = Driver::findOrFail($data['driver_id']);
        $vehicle = Vehicle::findOrFail($data['vehicle_id']);
        $jobOrder = JobOrder::findOrFail($data['job_order_id']);

        if ($driver->availability !== 'available' || $vehicle->status !== 'available') {
            return response()->json(['message' => 'Driver or vehicle not available'], 422);
        }

        $assignment = DispatchAssignment::create([
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'assigned_by' => $request->user()?->id,
            'status' => 'assigned',
            'assigned_at' => now(),
        ]);

        $driver->update(['availability' => 'busy']);
        $vehicle->update(['status' => 'assigned']);
        $jobOrder->update(['status' => 'assigned']);

        $assignment = $assignment->load('jobOrder', 'driver.user', 'vehicle');

        $this->notificationDispatcher->assignmentCreated($assignment);

        AuditLogger::record($request->user(), 'dispatch.assignment_created', DispatchAssignment::class, $assignment->id, [
            'job_order_id' => $jobOrder->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ], $request);

        return response()->json($assignment, 201);
    }
}
