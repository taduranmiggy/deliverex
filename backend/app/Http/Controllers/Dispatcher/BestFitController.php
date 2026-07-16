<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use App\Services\Assignment\BestFitAssignmentService;
use App\Services\Assignment\BestFitPipelineDiagnostic;
use Illuminate\Http\Request;

class BestFitController extends Controller
{
    public function __construct(
        private BestFitAssignmentService $service,
        private BestFitPipelineDiagnostic $diagnostic,
    ) {
    }

    public function show(Request $request, JobOrder $jobOrder)
    {
        $recommendations = $this->service->recommend($jobOrder);
        $overrideOptions = $this->service->overrideOptions($jobOrder);

        $includeDiagnostics = $request->boolean('include_diagnostics')
            || $recommendations === [];

        $payload = [
            'job_order_id' => $jobOrder->id,
            'recommended' => $recommendations[0] ?? null,
            'recommendations' => $recommendations,
            'override_options' => $overrideOptions,
        ];

        if ($includeDiagnostics) {
            $payload['diagnostics'] = $this->diagnostic->analyze($jobOrder);
        }

        return response()->json($payload);
    }
}
