<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use App\Support\AuditLogger;
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
            'customer_name' => 'required|string|max:120',
            'customer_contact' => 'nullable|string|max:50',
            'pickup_location' => 'required|string',
            'dropoff_location' => 'required|string',
            'job_requirements' => 'nullable|string',
            'vehicle_type_required' => 'nullable|string|max:80',
            'vehicle_capacity_required' => 'nullable|string|max:80',
            'weight_kg' => 'nullable|numeric|min:0',
            'volume_m3' => 'nullable|numeric|min:0',
            'scheduled_start' => 'nullable|date',
            'scheduled_end' => 'nullable|date|after_or_equal:scheduled_start',
            'priority' => 'nullable|in:low,normal,high,urgent',
        ]);

        $data['created_by'] = $request->user()?->id;
        $data['tracking_code'] = strtoupper(Str::random(10));
        $data['status'] = 'pending';
        $data['priority'] = $data['priority'] ?? 'normal';

        $jobOrder = JobOrder::create($data);

        AuditLogger::record($request->user(), 'job_order.created', JobOrder::class, $jobOrder->id, [
            'tracking_code' => $jobOrder->tracking_code,
        ], $request);

        return response()->json($jobOrder, 201);
    }

    public function update(Request $request, JobOrder $jobOrder)
    {
        $data = $request->validate([
            'customer_name' => 'sometimes|string|max:120',
            'customer_contact' => 'nullable|string|max:50',
            'pickup_location' => 'sometimes|string',
            'dropoff_location' => 'sometimes|string',
            'job_requirements' => 'nullable|string',
            'vehicle_type_required' => 'nullable|string|max:80',
            'vehicle_capacity_required' => 'nullable|string|max:80',
            'weight_kg' => 'nullable|numeric|min:0',
            'volume_m3' => 'nullable|numeric|min:0',
            'scheduled_start' => 'nullable|date',
            'scheduled_end' => 'nullable|date|after_or_equal:scheduled_start',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'status' => 'nullable|in:pending,assigned,in_progress,completed,cancelled',
        ]);

        $jobOrder->update($data);

        AuditLogger::record($request->user(), 'job_order.updated', JobOrder::class, $jobOrder->id, [], $request);

        return response()->json($jobOrder);
    }
}
