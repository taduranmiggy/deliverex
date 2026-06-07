<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\DeliveryDelayReport;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class DelayController extends Controller
{
    public function index(Request $request)
    {
        $query = DeliveryDelayReport::with([
            'jobOrder',
            'assignment.driver.user',
            'assignment.vehicle',
            'driver.user',
            'acknowledger',
        ])->latest();

        if ($request->boolean('unacknowledged')) {
            $query->whereNull('acknowledged_at');
        }

        if ($request->filled('assignment_id')) {
            $query->where('assignment_id', $request->integer('assignment_id'));
        }

        return response()->json($query->paginate(20));
    }

    public function acknowledge(Request $request, DeliveryDelayReport $delayReport)
    {
        if ($delayReport->acknowledged_at) {
            return response()->json([
                'message' => 'Delay already acknowledged.',
                'report'  => $delayReport->load('acknowledger'),
            ]);
        }

        $delayReport->update([
            'acknowledged_at' => now(),
            'acknowledged_by' => $request->user()->id,
        ]);

        AuditLogger::record($request->user(), 'delivery.delay_acknowledged', DeliveryDelayReport::class, $delayReport->id, [
            'assignment_id' => $delayReport->assignment_id,
            'delay_reason'  => $delayReport->delay_reason,
        ], $request);

        return response()->json([
            'message' => 'Delay acknowledged.',
            'report'  => $delayReport->load([
                'jobOrder',
                'assignment.driver.user',
                'assignment.vehicle',
                'driver.user',
                'acknowledger',
            ]),
        ]);
    }
}
