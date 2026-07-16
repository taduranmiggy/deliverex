<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use App\Services\Assignment\BestFitAssignmentService;
use App\Services\Assignment\BestFitPipelineDiagnostic;
use App\Services\Fleet\AssignmentResourceSyncService;
use Illuminate\Http\Request;

class BestFitController extends Controller
{
    public function __construct(
        private BestFitAssignmentService $service,
        private BestFitPipelineDiagnostic $diagnostic,
        private AssignmentResourceSyncService $resourceSync,
    ) {
    }

    public function show(Request $request, JobOrder $jobOrder)
    {
        // Close assignments that still block drivers/vehicles after their job finished.
        $this->resourceSync->repairStaleBlockingAssignments('best_fit_request');

        $recommendations = $this->service->recommend($jobOrder);
        $overrideOptions = $this->service->overrideOptions($jobOrder);
        $summary = $this->service->eligibilitySummary($jobOrder);

        $includeDiagnostics = $request->boolean('include_diagnostics')
            || $recommendations === [];

        $payload = [
            'job_order_id' => $jobOrder->id,
            'recommended' => $recommendations[0] ?? null,
            'recommendations' => $recommendations,
            'override_options' => $overrideOptions,
            'meta' => [
                ...$summary,
                'recommendation_count' => count($recommendations),
                'unique_recommended_drivers' => count(array_unique(array_column($recommendations, 'driver_id'))),
                'override_driver_count' => count($overrideOptions['drivers'] ?? []),
                'override_vehicle_count' => count($overrideOptions['vehicles'] ?? []),
                'stale_assignments_repaired' => true,
            ],
        ];

        if ($includeDiagnostics) {
            $payload['diagnostics'] = $this->diagnostic->analyze($jobOrder);
        }

        return response()->json($payload);
    }
}
