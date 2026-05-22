<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\AuditLogger;
use App\Support\JobOrderScheduleValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class JobOrderController extends Controller
{
    public function index()
    {
        return response()->json(JobOrder::with(['creator', 'assignments.driver.user', 'assignments.vehicle'])->latest()->paginate(20));
    }

    public function show(JobOrder $jobOrder)
    {
        return response()->json($jobOrder->load('creator', 'assignments.driver.user', 'assignments.vehicle'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_name'             => 'required|string|max:120',
            'customer_email'            => 'required|email|max:255',
            'customer_contact'          => 'nullable|string|max:50',
            'pickup_location'           => 'required|string',
            'dropoff_location'          => 'required|string',
            'delivery_type'             => 'nullable|string|max:80',
            'job_requirements'          => 'nullable|string',
            'notes'                     => 'nullable|string',
            'vehicle_type_required'     => 'nullable|string|max:80',
            'vehicle_capacity_required' => 'nullable|string|max:80',
            'weight_kg'                 => 'nullable|numeric|min:0',
            'volume_m3'                 => 'nullable|numeric|min:0',
            'scheduled_start'           => 'nullable|date',
            'scheduled_end'             => 'nullable|date|after_or_equal:scheduled_start',
            'priority'                  => 'nullable|in:low,normal,high,urgent',
        ]);

        JobOrderScheduleValidator::validatePayload($data);

        $normalizedEmail  = Str::lower($data['customer_email']);
        $customerAccount  = User::query()
            ->where('email', $normalizedEmail)
            ->whereHas('role', fn ($q) => $q->where('name', 'customer'))
            ->first();

        $data['created_by']        = $request->user()?->id;
        $data['customer_email']    = $normalizedEmail;
        $data['customer_user_id']  = $customerAccount?->id;
        $data['tracking_code']     = strtoupper(Str::random(10));
        $data['status']            = 'pending';
        $data['priority']          = $data['priority'] ?? 'normal';

        $jobOrder = JobOrder::create($data);

        AuditLogger::record($request->user(), 'job_order.created', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
        ], $request);

        return response()->json($jobOrder, 201);
    }

    public function update(Request $request, JobOrder $jobOrder)
    {
        $data = $request->validate([
            'customer_name'             => 'sometimes|string|max:120',
            'customer_email'            => 'sometimes|email|max:255',
            'customer_contact'          => 'nullable|string|max:50',
            'pickup_location'           => 'sometimes|string',
            'dropoff_location'          => 'sometimes|string',
            'delivery_type'             => 'nullable|string|max:80',
            'job_requirements'          => 'nullable|string',
            'notes'                     => 'nullable|string',
            'vehicle_type_required'     => 'nullable|string|max:80',
            'vehicle_capacity_required' => 'nullable|string|max:80',
            'weight_kg'                 => 'nullable|numeric|min:0',
            'volume_m3'                 => 'nullable|numeric|min:0',
            'scheduled_start'           => 'nullable|date',
            'scheduled_end'             => 'nullable|date|after_or_equal:scheduled_start',
            'priority'                  => 'nullable|in:low,normal,high,urgent',
            'status'                    => 'nullable|in:pending,assigned,in_progress,arrived,completed,cancelled',
        ]);

        JobOrderScheduleValidator::validatePayload($data);

        if (array_key_exists('customer_email', $data)) {
            $normalizedEmail = Str::lower($data['customer_email']);
            $customerAccount = User::query()
                ->where('email', $normalizedEmail)
                ->whereHas('role', fn ($q) => $q->where('name', 'customer'))
                ->first();
            $data['customer_email']   = $normalizedEmail;
            $data['customer_user_id'] = $customerAccount?->id;
        }

        $jobOrder->update($data);

        AuditLogger::record($request->user(), 'job_order.updated', JobOrder::class, $jobOrder->id, [], $request);

        return response()->json($jobOrder->fresh()->load('creator', 'assignments.driver.user', 'assignments.vehicle'));
    }

    public function destroy(Request $request, JobOrder $jobOrder)
    {
        // Only allow deleting jobs that aren't actively in progress
        if (in_array($jobOrder->status, ['in_progress', 'arrived'], true)) {
            return response()->json(['message' => 'Cannot delete a job that is currently in progress.'], 422);
        }

        // Free any driver/vehicle that was assigned to this job order
        foreach ($jobOrder->assignments()->whereIn('status', ['assigned', 'in_progress', 'arrived'])->get() as $assignment) {
            Driver::where('id', $assignment->driver_id)
                ->update(['availability' => 'available', 'current_assignment_id' => null]);
            Vehicle::where('id', $assignment->vehicle_id)
                ->update(['status' => 'available']);
        }

        AuditLogger::record($request->user(), 'job_order.deleted', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
            'status'        => $jobOrder->status,
        ], $request);

        $jobOrder->delete();

        return response()->json(['message' => 'Job order deleted.']);
    }
}
