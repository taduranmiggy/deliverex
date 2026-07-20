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
                'recommendation_limit' => BestFitAssignmentService::RECOMMENDATION_LIMIT,
                'total_scored_pairings' => $this->service->lastTotalScoredPairings(),
                'unique_recommended_drivers' => count(array_unique(array_column($recommendations, 'driver_id'))),
                'override_driver_count' => count($overrideOptions['drivers'] ?? []),
                'override_vehicle_count' => count($overrideOptions['vehicles'] ?? []),
                'override_selectable_driver_count' => count(array_filter(
                    $overrideOptions['drivers'] ?? [],
                    fn (array $row): bool => (bool) ($row['override_selectable'] ?? false),
                )),
                'override_selectable_vehicle_count' => count(array_filter(
                    $overrideOptions['vehicles'] ?? [],
                    fn (array $row): bool => (bool) ($row['override_selectable'] ?? false),
                )),
                'override_pairing_count' => count($overrideOptions['pairings'] ?? []),
                'stale_assignments_repaired' => true,
            ],
        ];

        if ($includeDiagnostics) {
            $payload['diagnostics'] = $this->diagnostic->analyze($jobOrder);
        }

        return response()->json($payload);
    }
}
