<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use App\Support\CustomerProofDocuments;
use Illuminate\Http\Request;

class PortalController extends Controller
{
    /**
     * List job orders for the signed-in customer's company.
     */
    public function orders(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $companyId = $user->companyUser?->company_id;

        if (! $companyId) {
            return response()->json(['data' => []]);
        }

        $orders = JobOrder::query()
            ->where('company_id', $companyId)
            ->with([
                'assignments' => function ($q) {
                    $q->latest('assigned_at');
                },
                'assignments.deliveryStatusLogs' => fn ($q) => $q->latest('created_at'),
                'assignments.deliveryDocuments.ocrResult',
                'assignments.completionProof.deliveryDocument.ocrResult',
            ])
            ->orderByDesc('updated_at')
            ->get();

        $data = $orders->map(function (JobOrder $job) {
            $assignment = $job->assignments->first();
            $latestStatus = $assignment
                ? $assignment->deliveryStatusLogs->first()
                : null;
            $status = $latestStatus?->status ?? $job->status;
            $statusAt = $latestStatus?->created_at?->toIso8601String();

            $documents = $assignment
                ? CustomerProofDocuments::forAssignment($assignment, (string) $status)
                : [];

            return [
                'id' => $job->id,
                'tracking_code' => $job->tracking_code,
                'status' => $status,
                'status_at' => $statusAt,
                'pickup_location' => $job->pickup_location,
                'dropoff_location' => $job->dropoff_location,
                'customer_contact' => $job->customer_contact,
                'scheduled_start' => $job->scheduled_start?->toIso8601String(),
                'scheduled_end' => $job->scheduled_end?->toIso8601String(),
                'priority' => $job->priority,
                'updated_at' => $job->updated_at?->toIso8601String(),
                'documents' => $documents,
            ];
        });

        return response()->json([
            'data' => $data,
        ]);
    }

    /**
     * @deprecated B2B deliveries auto-link by company. Kept for backward compatibility.
     */
    public function linkDelivery(Request $request)
    {
        $data = $request->validate([
            'tracking_code' => 'required|string|max:20',
        ]);

        /** @var \App\Models\User $user */
        $user = $request->user();
        $companyId = $user->companyUser?->company_id;
        $code = strtoupper(trim($data['tracking_code']));

        $job = JobOrder::query()->where('tracking_code', $code)->first();

        if (! $job) {
            return response()->json(['message' => 'Tracking ID not found.'], 404);
        }

        if ($companyId && (int) $job->company_id === (int) $companyId) {
            if ($job->customer_user_id !== $user->id) {
                $job->update(['customer_user_id' => $user->id]);
            }

            return response()->json([
                'message' => 'Delivery is already linked to your company.',
                'linked_count' => 1,
                'tracking_code' => $job->tracking_code,
            ]);
        }

        return response()->json([
            'message' => 'This delivery is not linked to your company account.',
        ], 403);
    }
}
