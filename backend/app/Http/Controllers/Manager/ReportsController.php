<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');

        $query = DispatchAssignment::with('jobOrder', 'driver.user', 'vehicle');

        if ($status) {
            $query->where('status', $status);
        }

        return response()->json($query->latest()->paginate(20));
    }
}
