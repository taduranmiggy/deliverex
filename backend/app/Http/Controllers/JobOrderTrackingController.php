<?php

namespace App\Http\Controllers;

use App\Models\JobOrder;
use App\Services\Gps\JobOrderTrackingService;

class JobOrderTrackingController extends Controller
{
    public function __construct(private JobOrderTrackingService $trackingService)
    {
    }

    public function show(JobOrder $jobOrder)
    {
        $user = request()->user();
        if (! $user || ! $this->trackingService->canView($user, $jobOrder)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $includeHistory = filter_var(request()->query('include_history', false), FILTER_VALIDATE_BOOL);
        $customerView = $user->role?->name === 'customer';

        return response()->json([
            'data' => $this->trackingService->payload($jobOrder, $customerView, $includeHistory),
        ]);
    }
}
