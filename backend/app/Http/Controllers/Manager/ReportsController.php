<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Services\Reports\DeliveriesReportQuery;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    public function __construct(private DeliveriesReportQuery $deliveriesQuery)
    {
    }

    public function index(Request $request)
    {
        ['query' => $query] = $this->deliveriesQuery->build($request);

        $perPage = max(1, min(100, (int) $request->query('per_page', 6)));

        return response()->json($query->paginate($perPage));
    }
}
