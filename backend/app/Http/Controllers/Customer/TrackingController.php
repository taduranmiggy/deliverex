<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;

class TrackingController extends Controller
{
    public function show(string $trackingCode)
    {
        $jobOrder = JobOrder::query()
            ->where('tracking_code', $trackingCode)
            ->firstOrFail();

        $latestAssignment = $jobOrder->assignments()
            ->latest('assigned_at')
            ->with([
                'deliveryStatusLogs',
                'trackingLogs',
                'deliveryDocuments.ocrResult',
            ])
            ->first();

        $latestStatus = $latestAssignment?->deliveryStatusLogs()
            ->orderByDesc('created_at')
            ->first();

        $latestTracking = $latestAssignment?->trackingLogs()
            ->orderByDesc('captured_at')
            ->first();

        $timeline = [];
        if ($latestAssignment) {
            $timeline = $latestAssignment->deliveryStatusLogs()
                ->orderBy('created_at')
                ->get(['status', 'notes', 'created_at'])
                ->map(fn ($row) => [
                    'status' => $row->status,
                    'notes' => $row->notes,
                    'at' => $row->created_at?->toIso8601String(),
                ])
                ->values()
                ->all();
        }

        return response()->json([
            'tracking_code' => $jobOrder->tracking_code,
            'status' => $latestStatus?->status ?? $jobOrder->status,
            'eta_window' => $this->etaLabel($jobOrder),
            'approximate_location' => $latestTracking
                ? [
                    'lat' => round((float) $latestTracking->latitude, 2),
                    'lng' => round((float) $latestTracking->longitude, 2),
                ]
                : null,
            'timeline' => $timeline,
            'delay_flag' => $this->delayFlag($jobOrder, $latestAssignment, $latestStatus),
        ]);
    }

    private function etaLabel(JobOrder $jobOrder): string
    {
        if ($jobOrder->scheduled_end) {
            return 'Target by '.$jobOrder->scheduled_end->timezone(config('app.timezone'))->format('M j, g:i A');
        }

        if ($jobOrder->scheduled_start) {
            return 'Scheduled '.$jobOrder->scheduled_start->timezone(config('app.timezone'))->format('M j, g:i A');
        }

        return 'Contact dispatcher for ETA';
    }

    private function delayFlag(JobOrder $jobOrder, $assignment, $latestStatus): bool
    {
        if (! $jobOrder->scheduled_end || ! $assignment) {
            return false;
        }

        $terminal = in_array($latestStatus?->status ?? $assignment->status, ['completed', 'cancelled'], true);
        if ($terminal) {
            return false;
        }

        return now()->isAfter($jobOrder->scheduled_end);
    }

}
