<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use App\Services\Assignment\BestFitAssignmentService;

class BestFitController extends Controller
{
    public function __construct(private BestFitAssignmentService $service)
    {
    }

    public function show(JobOrder $jobOrder)
    {
        $recommendations = $this->service->recommend($jobOrder);
        return response()->json([
            'job_order_id' => $jobOrder->id,
            'recommended' => $recommendations[0] ?? null,
            'recommendations' => $recommendations,
        ]);
    }
}
