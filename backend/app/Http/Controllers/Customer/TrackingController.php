<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\DeliveryCompletionProof;
use App\Models\JobOrder;
use App\Services\Delivery\EtaEstimationService;
use App\Support\CustomerProofDocuments;
use App\Support\DeliveryStatus;

class TrackingController extends Controller
{
    public function __construct(private EtaEstimationService $etaEstimation)
    {
    }

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
                'completionProof.deliveryDocument.ocrResult',
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
                ->get(['status', 'notes', 'created_at', 'synced_at', 'latitude', 'longitude', 'arrival_verified'])
                ->map(fn ($row) => $this->formatStatusEvent($row))
                ->values()
                ->all();
        }

        $rawCurrentStatus = $latestStatus?->status ?? $jobOrder->status;
        if (! $latestAssignment && in_array(strtolower((string) $jobOrder->status), ['pending', ''], true)) {
            $currentStatus = 'pending';
        } else {
            $currentStatus = DeliveryStatus::canonicalize($rawCurrentStatus) ?? $rawCurrentStatus;
        }
        $completionProof = $latestAssignment?->completionProof;
        $proofDocuments  = CustomerProofDocuments::forAssignment($latestAssignment, (string) $currentStatus);
        $proofAvailable  = strtolower((string) $currentStatus) === DeliveryStatus::COMPLETED
            && count($proofDocuments) > 0;

        $eta = $this->etaEstimation->estimate($jobOrder, $latestTracking, $currentStatus);

        $orderedTimeline = [
            [
                'status' => 'pending',
                'label' => 'Pending',
                'timestamp' => $jobOrder->created_at?->toIso8601String(),
                'event_at' => $jobOrder->created_at?->toIso8601String(),
                'synced_at' => null,
                'performed_offline' => false,
            ],
            ...collect(DeliveryStatus::lifecycle())
                ->map(fn (string $stage) => [
                    'status' => $stage,
                    'label' => $stage === DeliveryStatus::ASSIGNED ? 'Dispatched' : DeliveryStatus::label($stage),
                    'timestamp' => null,
                    'event_at' => null,
                    'synced_at' => null,
                    'performed_offline' => false,
                ])
                ->values()
                ->all(),
        ];
        if ($latestAssignment) {
            $timelineMetaMap = $latestAssignment->deliveryStatusLogs()
                ->orderBy('created_at')
                ->get(['status', 'created_at', 'synced_at'])
                ->mapWithKeys(function ($row) {
                    $normalized = DeliveryStatus::canonicalize((string) $row->status);
                    if (! $normalized) {
                        return [];
                    }

                    return [$normalized => [
                        'event_at' => $row->created_at?->toIso8601String(),
                        'synced_at' => $row->synced_at?->toIso8601String(),
                        'performed_offline' => $row->synced_at !== null,
                    ]];
                });

            foreach ($orderedTimeline as $index => $item) {
                $stage = $item['status'];
                $meta = $timelineMetaMap[$stage] ?? null;
                $orderedTimeline[$index]['timestamp'] = $meta['event_at'] ?? null;
                $orderedTimeline[$index]['event_at'] = $meta['event_at'] ?? null;
                $orderedTimeline[$index]['synced_at'] = $meta['synced_at'] ?? null;
                $orderedTimeline[$index]['performed_offline'] = $meta['performed_offline'] ?? false;
            }
        }

        return response()->json([
            'tracking_code'       => $jobOrder->tracking_code,
            'current_status'      => $currentStatus,
            'status'              => $currentStatus,
            'eta_window'          => $this->etaLabel($jobOrder),
            'eta'                 => $eta,
            'approximate_location'=> $latestTracking
                ? [
                    'lat' => round((float) $latestTracking->latitude, 2),
                    'lng' => round((float) $latestTracking->longitude, 2),
                ]
                : null,
            'timeline'            => $orderedTimeline,
            'status_events'       => $timeline,
            'proof_of_delivery_available' => $proofAvailable,
            'completion_proof'    => $completionProof ? [
                'proof_type'       => $completionProof->proof_type,
                'proof_type_label' => DeliveryCompletionProof::TYPES[$completionProof->proof_type] ?? $completionProof->proof_type,
                'receiver_name'    => $completionProof->receiver_name,
                'receiver_contact' => $completionProof->receiver_contact,
                'delivery_notes'   => $completionProof->delivery_notes,
                'submitted_at'     => $completionProof->created_at?->toIso8601String(),
                'submitted_event_at' => $completionProof->submitted_event_at,
            ] : null,
            'proof_documents'     => $proofDocuments,
            'delay_flag'          => $this->delayFlag($jobOrder, $latestAssignment, $latestStatus),
        ]);
    }

    private function formatStatusEvent($row): array
    {
        return [
            'status'            => DeliveryStatus::canonicalize((string) $row->status) ?? $row->status,
            'notes'             => $row->notes,
            'at'                => $row->created_at?->toIso8601String(),
            'event_at'          => $row->created_at?->toIso8601String(),
            'synced_at'         => $row->synced_at?->toIso8601String(),
            'performed_offline' => $row->synced_at !== null,
            'arrival_verified'  => (bool) $row->arrival_verified,
            'gps_verified_at'   => $row->arrival_verified
                ? $row->created_at?->toIso8601String()
                : null,
        ];
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
        $status = DeliveryStatus::canonicalize($latestStatus?->status ?? $assignment->status) ?? ($latestStatus?->status ?? $assignment->status);
        $terminal = in_array($status, [DeliveryStatus::COMPLETED, DeliveryStatus::CANCELLED], true);
        if ($terminal) {
            return false;
        }
        return now()->isAfter($jobOrder->scheduled_end);
    }
}
