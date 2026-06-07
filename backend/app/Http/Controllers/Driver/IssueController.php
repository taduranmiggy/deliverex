<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DeliveryIssueReport;
use App\Models\DispatchAssignment;
use App\Services\Notifications\NotificationDispatcher;
use App\Support\AuditLogger;
use App\Support\DriverAccount;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;

class IssueController extends Controller
{
    public function __construct(private NotificationDispatcher $notificationDispatcher)
    {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'issue_type'    => ['required', Rule::in(array_keys(DeliveryIssueReport::TYPES))],
            'notes'         => 'nullable|string|max:2000',
            'photo'         => [
                'nullable',
                File::types(['jpg', 'jpeg', 'png'])->max(10240),
            ],
        ]);

        $assignment = DispatchAssignment::with('jobOrder')->findOrFail($data['assignment_id']);
        $driver     = DriverAccount::require($request->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (in_array($assignment->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'Cannot report issues on a completed or cancelled assignment.'], 422);
        }

        $photoPath = null;
        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store('issue_photos', 'public');
        }

        $report = DeliveryIssueReport::create([
            'assignment_id' => $assignment->id,
            'driver_id'     => $driver->id,
            'reported_by'   => $request->user()->id,
            'issue_type'    => $data['issue_type'],
            'notes'         => $data['notes'] ?? null,
            'photo_path'    => $photoPath,
        ]);

        $this->notificationDispatcher->issueReported($report);

        AuditLogger::record($request->user(), 'delivery.issue_reported', DeliveryIssueReport::class, $report->id, [
            'assignment_id' => $assignment->id,
            'issue_type'    => $data['issue_type'],
        ], $request);

        return response()->json([
            'message' => 'Issue report submitted successfully.',
            'report'  => $report->load('assignment.jobOrder'),
        ], 201);
    }
}
