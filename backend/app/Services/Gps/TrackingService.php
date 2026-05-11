<?php

namespace App\Services\Gps;

use App\Models\DispatchAssignment;
use App\Models\TrackingLog;

class TrackingService
{
    public function latestForAssignment(DispatchAssignment $assignment): ?TrackingLog
    {
        return $assignment->trackingLogs()->latest('captured_at')->first();
    }
}
