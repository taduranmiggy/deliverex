<?php

namespace App\Http\Controllers\Dispatcher;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Services\JobOrder\CustomerHistoryService;
use Illuminate\Http\Request;

class ClientHistoryController extends Controller
{
    public function __construct(private CustomerHistoryService $customerHistory)
    {
    }

    public function show(Request $request, Client $client)
    {
        if ($client->status !== 'active') {
            return response()->json(['message' => 'Client is not active.'], 404);
        }

        $excludeId = $request->filled('exclude_job_order_id')
            ? $request->integer('exclude_job_order_id')
            : null;

        return response()->json($this->customerHistory->analyze($client, $excludeId));
    }
}
