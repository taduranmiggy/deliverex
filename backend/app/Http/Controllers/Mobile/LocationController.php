<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\DispatchAssignment;
use App\Services\Gps\TrackingService;
use App\Support\ActionTimestamp;
use App\Support\AuditLogger;
use App\Support\GpsCoordinateValidator;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function __construct(private TrackingService $trackingService)
    {
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'driver_id' => 'nullable|integer|exists:drivers,id',
            'assignment_id' => 'required|exists:dispatch_assignments,id',
            'job_order_id' => 'nullable|integer|exists:job_orders,id',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'speed' => 'nullable|numeric|min:0',
            'speed_kmh' => 'nullable|numeric|min:0',
            'heading' => 'nullable|numeric',
            'accuracy' => 'nullable|numeric|min:0',
            'accuracy_m' => 'nullable|numeric|min:0',
            'battery_level' => 'nullable|integer|min:0|max:100',
            'timestamp' => 'nullable|string',
            'captured_at' => 'nullable|string',
            'source' => 'nullable|string|max:40',
            'force' => 'nullable|boolean',
        ]);

        $driverId = $request->user()?->driver?->id;
        if (! $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (isset($data['driver_id']) && (int) $data['driver_id'] !== (int) $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $assignment = DispatchAssignment::findOrFail($data['assignment_id']);

        if ((int) $assignment->driver_id !== (int) $driverId) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (isset($data['job_order_id']) && (int) $data['job_order_id'] !== (int) $assignment->job_order_id) {
            return response()->json(['message' => 'Assignment does not match job order.'], 422);
        }

        if ($error = GpsCoordinateValidator::validate((float) $data['latitude'], (float) $data['longitude'])) {
            return response()->json(['message' => $error], 422);
        }

        $timestampMeta = ActionTimestamp::resolveFromRequestWithMeta($request);
        $capturedAt = isset($data['timestamp'])
            ? ActionTimestamp::resolve($data['timestamp'])
            : (isset($data['captured_at'])
                ? ActionTimestamp::resolve($data['captured_at'])
                : $timestampMeta['actionAt']);
        $syncedAt = $timestampMeta['fromClient'] ? now() : null;

        $result = $this->trackingService->record($assignment, [
            'latitude' => (float) $data['latitude'],
            'longitude' => (float) $data['longitude'],
            'accuracy_m' => $data['accuracy_m'] ?? $data['accuracy'] ?? null,
            'heading' => $data['heading'] ?? null,
            'speed_kmh' => $data['speed_kmh'] ?? $data['speed'] ?? null,
            'captured_at' => $capturedAt,
            'synced_at' => $syncedAt,
            'source' => $data['source'] ?? 'mobile_ping',
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
            'driver_id' => $driverId,
            'assignment_id' => $log->assignment_id,
            'job_order_id' => $assignment->job_order_id,
            'latitude' => $log->latitude,
            'longitude' => $log->longitude,
            'speed' => $log->speed_kmh,
            'heading' => $log->heading,
            'accuracy' => $log->accuracy_m,
            'battery_level' => $log->battery_level,
            'timestamp' => $log->captured_at?->toIso8601String(),
            'skipped' => $result['skipped'],
            'skip_reason' => $result['reason'],
            'location' => $fleet,
        ], $result['skipped'] ? 200 : 201);
    }
}
