<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use Illuminate\Support\Facades\Storage;

class TrackingController extends Controller
{
    public function show(string $trackingCode)
    {
        $normalized = strtoupper(trim($trackingCode));

        // Prevent demo seeder records from being visible on the public tracking page
        if (str_starts_with($normalized, 'DEMO-')) {
            abort(404);
        }

        $jobOrder = JobOrder::query()
            ->where('tracking_code', $normalized)
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
                    'notes'  => $row->notes,
                    'at'     => $row->created_at?->toIso8601String(),
                ])
                ->values()
                ->all();
        }

        // Proof-of-delivery documents (public-safe: only show POD docs from completed deliveries)
        $proofDocuments = [];
        $currentStatus = $latestStatus?->status ?? $jobOrder->status;
        if ($latestAssignment && $currentStatus === 'completed') {
            $proofDocuments = $latestAssignment->deliveryDocuments
                ->where('type', 'pod')
                ->map(fn ($doc) => [
                    'id'          => $doc->id,
                    'type'        => $doc->type,
                    'url'         => Storage::disk('public')->url($doc->file_path),
                    'uploaded_at' => $doc->created_at?->toIso8601String(),
                    'ocr_ready'   => $doc->ocrResult?->is_validated ?? false,
                ])
                ->values()
                ->all();
        }

        return response()->json([
            'tracking_code'       => $jobOrder->tracking_code,
            'status'              => $currentStatus,
            'eta_window'          => $this->etaLabel($jobOrder),
            'approximate_location'=> $latestTracking
                ? [
                    'lat' => round((float) $latestTracking->latitude, 2),
                    'lng' => round((float) $latestTracking->longitude, 2),
                ]
                : null,
            'timeline'            => $timeline,
            'proof_documents'     => $proofDocuments,
            'delay_flag'          => $this->delayFlag($jobOrder, $latestAssignment, $latestStatus),
        ]);
    }

    private function etaLabel(JobOrder $jobOrder): string
    {
        if ($jobOrder->scheduled_end) {
            return 'Target by ' . $jobOrder->scheduled_end->timezone(config('app.timezone'))->format('M j, g:i A');
        }
        if ($jobOrder->scheduled_start) {
            return 'Scheduled ' . $jobOrder->scheduled_start->timezone(config('app.timezone'))->format('M j, g:i A');
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
