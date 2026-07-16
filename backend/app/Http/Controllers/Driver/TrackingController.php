<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Services\Gps\TrackingService;
use App\Support\ActionTimestamp;
use App\Support\AuditLogger;
use App\Support\GpsCoordinateValidator;
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    public function __construct(private TrackingService $trackingService)
    {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'accuracy_m' => 'nullable|numeric|min:0',
            'heading' => 'nullable|numeric',
            'speed_kmh' => 'nullable|numeric|min:0',
            'speed' => 'nullable|numeric|min:0',
            'captured_at' => 'nullable|string',
            'action_timestamp' => 'nullable|string',
            'action_taken_at' => 'nullable|string',
            'source' => 'nullable|string|max:40',
            'battery_level' => 'nullable|integer|min:0|max:100',
            'force' => 'nullable|boolean',
        ]);

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);
        $driverId = $request->user()?->driver?->id;

        if ($assignment->driver_id !== $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($error = GpsCoordinateValidator::validate((float) $data['latitude'], (float) $data['longitude'])) {
            return response()->json(['message' => $error], 422);
        }

        $timestampMeta = ActionTimestamp::resolveFromRequestWithMeta($request);
        $capturedAt = isset($data['captured_at'])
            ? ActionTimestamp::resolve($data['captured_at'])
            : $timestampMeta['actionAt'];
        $syncedAt = $timestampMeta['fromClient'] ? now() : null;

        $result = $this->trackingService->record($assignment, [
            'latitude' => (float) $data['latitude'],
            'longitude' => (float) $data['longitude'],
            'accuracy_m' => $data['accuracy_m'] ?? null,
            'heading' => $data['heading'] ?? null,
            'speed_kmh' => $data['speed_kmh'] ?? $data['speed'] ?? null,
            'captured_at' => $capturedAt,
            'synced_at' => $syncedAt,
            'source' => $data['source'] ?? 'driver_ping',
            'force' => (bool) ($data['force'] ?? false),
            'battery_level' => $data['battery_level'] ?? null,
        ], $driverId);

        if ($result['skipped'] && $result['log'] === null) {
            AuditLogger::record($request->user(), 'gps.sync_failed', DispatchAssignment::class, $assignment->id, [
                'reason' => $result['reason'] ?? 'GPS update rejected.',
                'latitude' => (float) $data['latitude'],
                'longitude' => (float) $data['longitude'],
            ], $request);

            return response()->json([
                'message' => $result['reason'] ?? 'GPS update rejected.',
            ], 422);
        }

        $log = $result['log'];
        $fleet = $this->trackingService->formatForFleet($log);

        return response()->json([
            'id' => $log->id,
            'assignment_id' => $log->assignment_id,
            'latitude' => $log->latitude,
            'longitude' => $log->longitude,
            'accuracy_m' => $log->accuracy_m,
            'heading' => $log->heading,
            'speed_kmh' => $log->speed_kmh,
            'captured_at' => $log->captured_at?->toIso8601String(),
            'event_at' => $log->event_at,
            'synced_at' => $log->synced_at?->toIso8601String(),
            'skipped' => $result['skipped'],
            'skip_reason' => $result['reason'],
            'location' => $fleet,
        ], $result['skipped'] ? 200 : 201);
    }
}
