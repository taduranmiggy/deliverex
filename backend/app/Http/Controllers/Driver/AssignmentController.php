<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Support\DeliveryStatus;
use App\Support\DriverAccount;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function index(Request $request)
    {
        $driver = DriverAccount::require($request->user());
        $perPage = max(1, min(100, (int) $request->query('per_page', 6)));

        return response()->json(
            DispatchAssignment::with('jobOrder', 'vehicle')
                ->where('driver_id', $driver->id)
                ->latest()
                ->paginate($perPage)
                ->through(fn (DispatchAssignment $assignment) => $this->withNextAction($assignment))
        );
    }

    public function show(DispatchAssignment $assignment)
    {
        $driver = DriverAccount::require(auth()->user());

        if ($assignment->driver_id !== $driver->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($this->withNextAction(
            $assignment->load(
                'jobOrder',
                'vehicle',
                'deliveryStatusLogs',
                'trackingLogs',
                'deliveryDocuments.ocrResult',
                'completionProof.deliveryDocument.ocrResult',
            )
        ));
    }

    private function withNextAction(DispatchAssignment $assignment): DispatchAssignment
    {
        $canonical = DeliveryStatus::canonicalize($assignment->status) ?? $assignment->status;
        $action = DeliveryStatus::nextAction($canonical);

        $assignment->setAttribute('status', $canonical);
        $assignment->setAttribute('next_status', $action['next_status']);
        $assignment->setAttribute('allowed_action', $action['next_status'] ? $action['label'] : null);

        return $assignment;
    }
}
