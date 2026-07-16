<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Fleet\AssignmentResourceSyncService;
use App\Services\Fleet\ResourceConsistencyService;
use Illuminate\Http\Request;

class ResourceConsistencyController extends Controller
{
    public function __construct(
        private ResourceConsistencyService $consistencyService,
        private AssignmentResourceSyncService $resourceSync,
    ) {
    }

    public function show()
    {
        return response()->json($this->consistencyService->report());
    }

    public function reconcile(Request $request)
    {
        $result = $this->resourceSync->reconcileAll('admin_reconcile');

        return response()->json([
            'message' => 'Fleet resource reconciliation completed.',
            'result'  => $result,
            'report'  => $this->consistencyService->report(),
        ]);
    }
}
