<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\DeliveryCompletionProof;
use App\Models\JobOrder;
use App\Services\Delivery\EtaEstimationService;
use Illuminate\Support\Facades\Storage;

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
                ->get(['status', 'notes', 'created_at', 'latitude', 'longitude', 'arrival_verified'])
                ->map(fn ($row) => [
                    'status'            => $row->status,
                    'notes'             => $row->notes,
                    'at'                => $row->created_at?->toIso8601String(),
                    'arrival_verified'  => (bool) $row->arrival_verified,
                    'gps_verified_at'   => $row->arrival_verified
                        ? $row->created_at?->toIso8601String()
                        : null,
                ])
                ->values()
                ->all();
        }

        $currentStatus = $latestStatus?->status ?? $jobOrder->status;
        $completionProof = $latestAssignment?->completionProof;
        $proofDocuments  = [];
        $proofAvailable  = $currentStatus === 'completed' && $completionProof !== null;

        if ($proofAvailable) {
            $doc = $completionProof->deliveryDocument;
            if ($doc) {
                $proofDocuments[] = [
                    'id'          => $doc->id,
                    'type'        => $doc->type,
                    'proof_type'  => $completionProof->proof_type,
                    'label'       => DeliveryCompletionProof::TYPES[$completionProof->proof_type] ?? $doc->type,
                    'url'         => Storage::disk('public')->url($doc->file_path),
                    'uploaded_at' => $completionProof->created_at?->toIso8601String(),
                    'ocr_ready'   => $doc->ocrResult?->is_validated ?? false,
                ];
            }
            if ($completionProof->receiver_signature_path) {
                $proofDocuments[] = [
                    'id'          => null,
                    'type'        => 'signature',
                    'proof_type'  => 'receiver_signature',
                    'label'       => 'Receiver Signature',
                    'url'         => Storage::disk('public')->url($completionProof->receiver_signature_path),
                    'uploaded_at' => $completionProof->created_at?->toIso8601String(),
                    'ocr_ready'   => false,
                ];
            }
        }

        $eta = $this->etaEstimation->estimate($jobOrder, $latestTracking, $currentStatus);

        return response()->json([
            'tracking_code'       => $jobOrder->tracking_code,
            'status'              => $currentStatus,
            'eta_window'          => $this->etaLabel($jobOrder),
            'eta'                 => $eta,
            'approximate_location'=> $latestTracking
                ? [
                    'lat' => round((float) $latestTracking->latitude, 2),
                    'lng' => round((float) $latestTracking->longitude, 2),
                ]
                : null,
            'timeline'            => $timeline,
            'proof_of_delivery_available' => $proofAvailable,
            'completion_proof'    => $completionProof ? [
                'proof_type'       => $completionProof->proof_type,
                'proof_type_label' => DeliveryCompletionProof::TYPES[$completionProof->proof_type] ?? $completionProof->proof_type,
                'receiver_name'    => $completionProof->receiver_name,
                'receiver_contact' => $completionProof->receiver_contact,
                'delivery_notes'   => $completionProof->delivery_notes,
                'submitted_at'     => $completionProof->created_at?->toIso8601String(),
            ] : null,
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
