<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DeliveryDelayReport;
use App\Models\DispatchAssignment;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AuditLogger;
use App\Support\DriverAccount;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DelayController extends Controller
{
    public function __construct(private NotificationDispatcher $notificationDispatcher)
    {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'delay_reason'  => ['required', Rule::in(array_keys(DeliveryDelayReport::REASONS))],
            'delay_notes'   => 'nullable|string|max:2000|required_if:delay_reason,other',
        ], [
            'delay_notes.required_if' => 'Please provide notes when selecting Other as the delay reason.',
        ]);

        $assignment = DispatchAssignment::with('jobOrder')->findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (in_array($assignment->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'Cannot report delay on a completed or cancelled assignment.'], 422);
        }

        $report = DeliveryDelayReport::create([
            'job_order_id'  => $assignment->job_order_id,
            'assignment_id' => $assignment->id,
            'driver_id'     => $driver->id,
            'reported_by'   => $request->user()->id,
            'delay_reason'  => $data['delay_reason'],
            'delay_notes'   => $data['delay_notes'] ?? null,
        ]);

        $this->notificationDispatcher->delayReported($report);

        AuditLogger::record($request->user(), 'delivery.delay_reported', DeliveryDelayReport::class, $report->id, [
            'assignment_id' => $assignment->id,
            'delay_reason'  => $data['delay_reason'],
        ], $request);

        return response()->json([
            'message' => 'Delay report submitted successfully.',
            'report'  => $report->load('assignment.jobOrder'),
        ], 201);
    }
}
