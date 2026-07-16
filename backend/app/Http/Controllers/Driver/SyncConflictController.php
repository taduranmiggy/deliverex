<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\SyncConflict;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class SyncConflictController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        $query = SyncConflict::query()
            ->where('user_id', $request->user()->id)
            ->latest();

        if ($action = $request->query('action_type')) {
            $query->where('action_type', $action);
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'action_type' => 'required|string|max:40',
            'entity_type' => 'nullable|string|max:120',
            'entity_id' => 'nullable|integer',
            'server_version' => 'nullable|array',
            'client_version' => 'nullable|array',
            'changed_fields' => 'nullable|array',
            'resolution' => 'required|string|in:keep_server,keep_local,manual_merge',
            'client_action_at' => 'nullable|date',
        ]);

        $conflict = SyncConflict::create([
            ...$data,
            'user_id' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        AuditLogger::record($request->user(), 'offline.conflict_resolved', SyncConflict::class, $conflict->id, [
            'action_type' => $conflict->action_type,
            'resolution' => $conflict->resolution,
            'entity_type' => $conflict->entity_type,
            'entity_id' => $conflict->entity_id,
        ], $request);

        return response()->json(['data' => $conflict], 201);
    }
}
