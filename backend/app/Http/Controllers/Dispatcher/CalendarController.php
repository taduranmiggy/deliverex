<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\DeliveryIssueReport;
use App\Models\DispatchAssignment;
use App\Models\Driver;
use App\Models\JobOrder;
use App\Models\Vehicle;
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

        $events = $this->buildEvents($start, $end);
        $conflicts = $this->detectScheduleConflicts($events);

        foreach ($events as &$event) {
            $event['has_conflict'] = collect($conflicts)->contains(
                fn ($c) => in_array($event['id'], $c['event_ids'], true)
            );
        }
        unset($event);

        return response()->json([
            'start'    => $start->toIso8601String(),
            'end'      => $end->toIso8601String(),
            'events'   => $events,
            'summary'  => $this->buildTodaySummary(),
            'upcoming' => $this->buildUpcoming(),
            'conflicts'=> $conflicts,
            'filters'  => $this->buildFilterOptions(),
        ]);
    }

    private function buildEvents(Carbon $start, Carbon $end): array
    {
        $events = [];

        $jobs = JobOrder::query()
            ->with([
                'assignments' => fn ($q) => $q->latest('id')->limit(1),
                'assignments.driver.user',
                'assignments.vehicle',
                'assignments.issueReports',
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

            $displayStatus = $this->resolveDisplayStatus($job, $assignment);
            $isDelayed     = $this->isDelayed($job, $displayStatus);
            $hasIssue      = $assignment && $assignment->issueReports->isNotEmpty();

            $vehicle = $assignment?->vehicle;
            $events[] = [
                'id'                => 'job-' . $job->id,
                'type'              => 'job',
                'job_order_id'      => $job->id,
                'job_number'        => $this->formatJobNumber($job->id, $eventStart),
                'tracking_code'     => $job->tracking_code,
                'customer_name'     => $job->customer_name,
                'delivery_type'     => $job->delivery_type,
                'pickup_location'   => $job->pickup_location,
                'dropoff_location'  => $job->dropoff_location,
                'notes'             => $job->notes,
                'driver_id'         => $assignment?->driver_id,
                'driver_name'       => $assignment?->driver?->user?->name,
                'vehicle_id'        => $assignment?->vehicle_id,
                'vehicle_plate'     => $vehicle?->plate_no,
                'vehicle_name'      => $vehicle ? trim(($vehicle->type ?? 'Vehicle') . ' · ' . $vehicle->plate_no) : null,
                'assignment_id'     => $assignment?->id,
                'assignment_status' => $assignment?->status,
                'start'             => $eventStart->toIso8601String(),
                'end'               => $eventEnd->toIso8601String(),
                'status'            => $displayStatus,
                'job_status'        => $job->status,
                'priority'          => $job->priority,
                'is_delayed'        => $isDelayed,
                'has_issue'         => $hasIssue,
                'category'          => $this->eventCategory($displayStatus, $isDelayed, $hasIssue),
            ];
        }

        usort($events, fn ($a, $b) => strcmp($a['start'], $b['start']));

        return $events;
    }

    private function buildTodaySummary(): array
    {
        $todayStart = now()->startOfDay();
        $todayEnd   = now()->endOfDay();

        $todayJobs = JobOrder::query()
            ->where(function ($q) use ($todayStart, $todayEnd) {
                $q->whereBetween('scheduled_start', [$todayStart, $todayEnd])
                    ->orWhere(function ($inner) use ($todayStart, $todayEnd) {
                        $inner->whereNotNull('scheduled_end')
                            ->where('scheduled_start', '<=', $todayEnd)
                            ->where('scheduled_end', '>=', $todayStart);
                    });
            })
            ->get();

        $todayJobIds = $todayJobs->pluck('id');

        $assignedToday = DispatchAssignment::query()
            ->whereIn('job_order_id', $todayJobIds)
            ->whereIn('status', ['assigned', 'in_progress', 'arrived'])
            ->count();

        $completedToday = DispatchAssignment::query()
            ->whereIn('job_order_id', $todayJobIds)
            ->where('status', 'completed')
            ->where(function ($q) use ($todayStart, $todayEnd) {
                $q->whereBetween('completed_at', [$todayStart, $todayEnd])
                    ->orWhere(function ($inner) use ($todayStart, $todayEnd) {
                        $inner->whereNull('completed_at')
                            ->whereBetween('updated_at', [$todayStart, $todayEnd]);
                    });
            })
            ->count();

        $delayed = JobOrder::query()
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('scheduled_end')
            ->where('scheduled_end', '<', now())
            ->count();

        $issueReports = DeliveryIssueReport::query()
            ->whereBetween('created_at', [$todayStart, $todayEnd])
            ->count();

        $unassigned = JobOrder::query()
            ->where('status', 'pending')
            ->whereDoesntHave('assignments', fn ($q) => $q->whereNotIn('status', ['cancelled']))
            ->where(function ($q) use ($todayStart, $todayEnd) {
                $q->whereBetween('scheduled_start', [$todayStart, $todayEnd])
                    ->orWhereNull('scheduled_start');
            })
            ->count();

        return [
            'today_deliveries'   => $todayJobs->count(),
            'assigned_deliveries'=> $assignedToday,
            'completed_deliveries'=> $completedToday,
            'delayed_deliveries' => $delayed,
            'issue_reports'      => $issueReports,
            'unassigned_jobs'    => $unassigned,
        ];
    }

    private function buildUpcoming(): array
    {
        $now = now();

        $nextDeliveries = JobOrder::query()
            ->with(['assignments' => fn ($q) => $q->latest('id')->limit(1), 'assignments.driver.user', 'assignments.vehicle'])
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('scheduled_start')
            ->where('scheduled_start', '>=', $now)
            ->orderBy('scheduled_start')
            ->limit(5)
            ->get()
            ->map(fn ($job) => $this->compactJobCard($job));

        $delayed = JobOrder::query()
            ->with(['assignments' => fn ($q) => $q->latest('id')->limit(1), 'assignments.driver.user'])
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('scheduled_end')
            ->where('scheduled_end', '<', $now)
            ->orderBy('scheduled_end')
            ->limit(5)
            ->get()
            ->map(fn ($job) => $this->compactJobCard($job));

        $needsAssignment = JobOrder::query()
            ->where('status', 'pending')
            ->whereDoesntHave('assignments', fn ($q) => $q->whereNotIn('status', ['cancelled']))
            ->orderByRaw('scheduled_start IS NULL, scheduled_start ASC')
            ->limit(5)
            ->get()
            ->map(fn ($job) => $this->compactJobCard($job));

        return [
            'next_deliveries'    => $nextDeliveries,
            'delayed_deliveries' => $delayed,
            'needs_assignment'   => $needsAssignment,
        ];
    }

    private function compactJobCard(JobOrder $job): array
    {
        $assignment = $job->assignments->first();

        return [
            'job_order_id'  => $job->id,
            'job_number'    => $this->formatJobNumber($job->id, $job->scheduled_start ?? $job->created_at),
            'customer_name' => $job->customer_name,
            'status'        => $this->resolveDisplayStatus($job, $assignment),
            'scheduled_start'=> $job->scheduled_start?->toIso8601String(),
            'driver_name'   => $assignment?->driver?->user?->name,
        ];
    }

    private function buildFilterOptions(): array
    {
        return [
            'drivers' => Driver::query()
                ->with('user')
                ->orderBy('id')
                ->get()
                ->map(fn ($d) => ['id' => $d->id, 'name' => $d->user?->name ?? 'Driver #' . $d->id]),
            'vehicles' => Vehicle::query()
                ->orderBy('plate_no')
                ->get()
                ->map(fn ($v) => ['id' => $v->id, 'label' => trim(($v->type ?? 'Vehicle') . ' · ' . $v->plate_no)]),
            'statuses' => [
                ['value' => 'pending', 'label' => 'Pending'],
                ['value' => 'assigned', 'label' => 'Assigned'],
                ['value' => 'in_progress', 'label' => 'En Route'],
                ['value' => 'arrived', 'label' => 'Arrived'],
                ['value' => 'completed', 'label' => 'Completed'],
                ['value' => 'cancelled', 'label' => 'Cancelled'],
                ['value' => 'delayed', 'label' => 'Delayed'],
                ['value' => 'issue_reported', 'label' => 'Issue Reported'],
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $events
     * @return array<int, array<string, mixed>>
     */
    private function detectScheduleConflicts(array $events): array
    {
        $byVehicle = collect($events)
            ->filter(fn ($e) => ! empty($e['vehicle_id']) && ($e['status'] ?? '') !== 'cancelled')
            ->groupBy('vehicle_id');

        $conflicts = [];

        foreach ($byVehicle as $vehicleId => $items) {
            $sorted = $items->sortBy('start')->values()->all();
            $count  = count($sorted);

            for ($i = 0; $i < $count; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    if ($this->rangesOverlap($sorted[$i]['start'], $sorted[$i]['end'], $sorted[$j]['start'], $sorted[$j]['end'])) {
                        $conflicts[] = [
                            'vehicle_id'    => (int) $vehicleId,
                            'vehicle_label' => $sorted[$i]['vehicle_name'] ?? $sorted[$i]['vehicle_plate'] ?? 'Vehicle',
                            'event_ids'     => [$sorted[$i]['id'], $sorted[$j]['id']],
                            'message'       => 'Schedule Conflict Detected',
                            'details'       => sprintf(
                                '%s overlaps with %s',
                                $sorted[$i]['job_number'],
                                $sorted[$j]['job_number']
                            ),
                        ];
                    }
                }
            }
        }

        return $conflicts;
    }

    private function rangesOverlap(string $startA, string $endA, string $startB, string $endB): bool
    {
        $aStart = Carbon::parse($startA);
        $aEnd   = Carbon::parse($endA);
        $bStart = Carbon::parse($startB);
        $bEnd   = Carbon::parse($endB);

        return $aStart->lt($bEnd) && $aEnd->gt($bStart);
    }

    private function resolveDisplayStatus(JobOrder $job, ?DispatchAssignment $assignment): string
    {
        if ($assignment && ! in_array($assignment->status, ['cancelled'], true)) {
            return $assignment->status;
        }

        return $job->status;
    }

    private function isDelayed(JobOrder $job, string $status): bool
    {
        return ! in_array($status, ['completed', 'cancelled'], true)
            && $job->scheduled_end
            && $job->scheduled_end->isPast();
    }

    private function eventCategory(string $status, bool $isDelayed, bool $hasIssue): string
    {
        if ($isDelayed) {
            return 'delayed';
        }
        if ($hasIssue) {
            return 'issue_reported';
        }

        return match ($status) {
            'pending'     => 'pending',
            'assigned'    => 'assigned',
            'in_progress' => 'in_progress',
            'arrived'     => 'arrived',
            'completed'   => 'completed',
            'cancelled'   => 'cancelled',
            default       => 'assigned',
        };
    }

    private function formatJobNumber(int $id, Carbon $ref): string
    {
        return 'JO-' . $ref->year . '-' . str_pad((string) $id, 3, '0', STR_PAD_LEFT);
    }
}
