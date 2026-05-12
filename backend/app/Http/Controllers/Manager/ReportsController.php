<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ReportsController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');
        $dateField = $request->query('date_field', 'assigned_at');
        $from = $request->query('from');
        $to = $request->query('to');

        $allowedDateFields = ['assigned_at', 'started_at', 'completed_at', 'created_at'];
        if (! in_array($dateField, $allowedDateFields, true)) {
            return response()->json(['message' => 'Invalid date_field'], 422);
        }

        $query = DispatchAssignment::with('jobOrder', 'driver.user', 'vehicle');

        if ($status) {
            $query->where('status', $status);
        }

        if ($from || $to) {
            try {
                $fromDate = $from ? Carbon::parse($from)->startOfDay() : null;
                $toDate = $to ? Carbon::parse($to)->endOfDay() : null;
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Invalid date range'], 422);
            }

            if ($fromDate && $toDate) {
                $query->whereBetween($dateField, [$fromDate, $toDate]);
            } elseif ($fromDate) {
                $query->where($dateField, '>=', $fromDate);
            } elseif ($toDate) {
                $query->where($dateField, '<=', $toDate);
            }
        }

        return response()->json($query->latest()->paginate(20));
    }
}
