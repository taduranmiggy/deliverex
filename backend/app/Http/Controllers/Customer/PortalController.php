<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PortalController extends Controller
{
    /**
     * List job orders linked to the signed-in customer.
     */
    public function orders(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $orders = JobOrder::query()
            ->where('customer_user_id', $user->id)
            ->with([
                'assignments' => function ($q) {
                    $q->latest('assigned_at');
                },
                'assignments.deliveryStatusLogs' => fn ($q) => $q->latest('created_at'),
                'assignments.deliveryDocuments.ocrResult',
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

            $documents = [];
            $isCompleted = strtolower((string) $status) === 'completed';
            if ($assignment && $isCompleted) {
                foreach ($assignment->deliveryDocuments->where('type', 'pod') as $doc) {
                    $documents[] = [
                        'id' => $doc->id,
                        'type' => $doc->type,
                        'url' => Storage::disk('public')->url($doc->file_path),
                        'uploaded_at' => $doc->created_at?->toIso8601String(),
                        'ocr_status' => $doc->ocrResult?->processing_status,
                    ];
                }
            }

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
}
