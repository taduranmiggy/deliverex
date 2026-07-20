<?php

namespace App\Events;

use App\Models\TrackingLog;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast the moment a driver GPS ping is persisted.
 *
 * ShouldBroadcastNow: pushed to the WebSocket server synchronously within the
 * ingest request — no queue worker required, no delay.
 */
class DriverLocationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public TrackingLog $log,
        public ?int $jobOrderId = null,
        /** @var array<string, mixed>|null Pre-formatted fleet location payload. */
        public ?array $fleetLocation = null,
    ) {
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('fleet.live'),
            new PrivateChannel('trip.'.$this->log->assignment_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'driver.location.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'driver_id' => $this->log->driver_id,
            'trip_id' => $this->log->assignment_id,
            'assignment_id' => $this->log->assignment_id,
            'job_order_id' => $this->jobOrderId,
            'latitude' => (float) $this->log->latitude,
            'longitude' => (float) $this->log->longitude,
            'timestamp' => $this->log->captured_at?->toIso8601String(),
            'heading' => $this->log->heading !== null ? (float) $this->log->heading : null,
            'speed' => $this->log->speed_kmh !== null ? (float) $this->log->speed_kmh : null,
            'speed_kmh' => $this->log->speed_kmh !== null ? (float) $this->log->speed_kmh : null,
            'accuracy_m' => $this->log->accuracy_m !== null ? (float) $this->log->accuracy_m : null,
            'battery_level' => $this->log->battery_level,
            'location' => $this->fleetLocation,
        ];
    }
}
