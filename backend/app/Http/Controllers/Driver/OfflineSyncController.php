<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\OfflineSyncQueue;
use App\Support\ActionTimestamp;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

/**
 * FR 1.20 — server-side offline queue registration for audit and recovery.
 */
class OfflineSyncController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'device_id' => 'nullable|string|max:64',
            'items' => 'required|array|min:1|max:50',
            'items.*.client_queue_id' => 'required|string|max:64',
            'items.*.action_type' => 'required|string|max:40',
            'items.*.payload' => 'required|array',
            'items.*.action_timestamp' => 'nullable|date',
            'items.*.action_taken_at' => 'nullable|date',
        ]);

        $user = $request->user();
        $created = [];

        foreach ($data['items'] as $item) {
            $row = OfflineSyncQueue::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'client_queue_id' => $item['client_queue_id'],
                ],
                [
                    'device_id' => $data['device_id'] ?? null,
                    'action_type' => $item['action_type'],
                    'payload' => $item['payload'],
                    'action_timestamp' => ActionTimestamp::resolve(
                        $item['action_timestamp'] ?? $item['action_taken_at'] ?? null
                    ),
                    'status' => 'pending',
                ],
            );
            $created[] = $row->only(['id', 'client_queue_id', 'status']);
        }

        return response()->json([
            'message' => 'Offline queue registered',
            'items' => $created,
        ]);
    }

    public function markSynced(Request $request)
    {
        $data = $request->validate([
            'client_queue_ids' => 'required|array|min:1',
            'client_queue_ids.*' => 'string|max:64',
        ]);

        OfflineSyncQueue::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('client_queue_id', $data['client_queue_ids'])
            ->update([
                'status' => 'synced',
                'synced_at' => now(),
            ]);

        AuditLogger::record($request->user(), 'offline.sync_completed', OfflineSyncQueue::class, null, [
            'item_count' => count($data['client_queue_ids']),
            'client_queue_ids' => $data['client_queue_ids'],
        ], $request);

        return response()->json(['message' => 'Queue items marked synced']);
    }
}
