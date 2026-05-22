<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\JobOrder;
use App\Models\OcrResult;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'start' => 'required|date',
            'end'   => 'required|date|after_or_equal:start',
        ]);

        $start = Carbon::parse($data['start'])->startOfDay();
        $end   = Carbon::parse($data['end'])->endOfDay();

        $events = [];

        $jobs = JobOrder::query()
            ->with([
                'assignments' => fn ($q) => $q->latest('id')->limit(1),
                'assignments.driver.user',
                'assignments.vehicle',
            ])
            ->where(function ($q) use ($start, $end) {
                $q->where(function ($sched) use ($start, $end) {
                    $sched->whereNotNull('scheduled_start')
                        ->where('scheduled_start', '<=', $end)
                        ->where(function ($inner) use ($start) {
                            $inner->where(function ($withEnd) use ($start) {
                                $withEnd->whereNotNull('scheduled_end')
                                    ->where('scheduled_end', '>=', $start);
                            })->orWhere(function ($noEnd) use ($start) {
                                $noEnd->whereNull('scheduled_end')
                                    ->where('scheduled_start', '>=', $start->copy()->subDay());
                            });
                        });
                })
                    ->orWhere(function ($unsched) use ($start, $end) {
                        $unsched->whereNull('scheduled_start')
                            ->whereBetween('created_at', [$start, $end]);
                    })
                    ->orWhereHas('assignments', function ($a) use ($start, $end) {
                        $a->whereBetween('assigned_at', [$start, $end]);
                    });
            })
            ->get();

        foreach ($jobs as $job) {
            $assignment = $job->assignments->first();
            $eventStart = $job->scheduled_start
                ?? $assignment?->assigned_at
                ?? $job->created_at;
            $eventEnd   = $job->scheduled_end
                ?? ($eventStart ? $eventStart->copy()->addHours(4) : $job->created_at->copy()->addHour());

            if ($eventStart->gt($end) || $eventEnd->lt($start)) {
                continue;
            }

            $status    = $job->status;
            $isDelayed = ! in_array($status, ['completed', 'cancelled'], true)
                && $job->scheduled_end
                && $job->scheduled_end->isPast();

            $events[] = [
                'id'              => 'job-' . $job->id,
                'type'            => 'job',
                'job_order_id'    => $job->id,
                'job_number'      => 'J-' . $eventStart->year . '-' . str_pad((string) $job->id, 3, '0', STR_PAD_LEFT),
                'tracking_code'   => $job->tracking_code,
                'customer_name'   => $job->customer_name,
                'driver_name'     => $assignment?->driver?->user?->name,
                'vehicle_plate'   => $assignment?->vehicle?->plate_no,
                'assignment_id'   => $assignment?->id,
                'assignment_status' => $assignment?->status,
                'start'           => $eventStart->toIso8601String(),
                'end'             => $eventEnd->toIso8601String(),
                'status'          => $status,
                'priority'        => $job->priority,
                'is_delayed'      => $isDelayed,
                'category'        => $this->jobCategory($status, $isDelayed, $assignment !== null),
                'pickup_location' => $job->pickup_location,
                'dropoff_location'=> $job->dropoff_location,
            ];
        }

        $ocrResults = OcrResult::query()
            ->with(['document.assignment.jobOrder', 'document.assignment.driver.user'])
            ->whereHas('document.assignment.jobOrder')
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween('created_at', [$start, $end])
                    ->orWhereBetween('updated_at', [$start, $end]);
            })
            ->get();

        foreach ($ocrResults as $ocr) {
            $doc = $ocr->document;
            $assignment = $doc?->assignment;
            $job = $assignment?->jobOrder;
            if (! $job) {
                continue;
            }

            $eventAt = $ocr->updated_at ?? $ocr->created_at;
            if ($eventAt->lt($start) || $eventAt->gt($end)) {
                continue;
            }

            $label = match ($ocr->processing_status) {
                'pending', 'processing' => 'OCR processing',
                'failed'                => 'OCR failed',
                default                 => $ocr->is_validated ? 'OCR validated' : 'OCR ready for review',
            };

            $events[] = [
                'id'              => 'ocr-' . $ocr->id,
                'type'            => 'ocr',
                'job_order_id'    => $job->id,
                'job_number'      => 'J-' . $eventAt->year . '-' . str_pad((string) $job->id, 3, '0', STR_PAD_LEFT),
                'tracking_code'   => $job->tracking_code,
                'customer_name'   => $job->customer_name,
                'driver_name'     => $assignment?->driver?->user?->name,
                'vehicle_plate'   => $assignment?->vehicle?->plate_no,
                'assignment_id'   => $assignment?->id,
                'ocr_result_id'   => $ocr->id,
                'document_type'   => $doc?->type,
                'start'           => $eventAt->toIso8601String(),
                'end'             => $eventAt->copy()->addMinutes(30)->toIso8601String(),
                'status'          => $ocr->processing_status,
                'is_delayed'      => false,
                'category'        => 'ocr',
                'title'           => $label,
            ];
        }

        usort($events, fn ($a, $b) => strcmp($a['start'], $b['start']));

        return response()->json([
            'start'  => $start->toIso8601String(),
            'end'    => $end->toIso8601String(),
            'events' => $events,
        ]);
    }

    private function jobCategory(string $status, bool $isDelayed, bool $hasAssignment): string
    {
        if ($isDelayed) {
            return 'delayed';
        }

        return match ($status) {
            'pending'   => 'pending',
            'completed' => 'completed',
            'cancelled' => 'cancelled',
            default     => $hasAssignment ? 'assigned' : 'scheduled',
        };
    }
}
