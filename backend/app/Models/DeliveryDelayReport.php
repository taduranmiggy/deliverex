<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryDelayReport extends Model
{
    public $timestamps = false;

    protected $appends = [
        'reported_event_at',
    ];

    protected $fillable = [
        'job_order_id',
        'assignment_id',
        'driver_id',
        'reported_by',
        'delay_reason',
        'delay_notes',
        'acknowledged_at',
        'acknowledged_by',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'acknowledged_at' => 'datetime',
    ];

    public function getReportedEventAtAttribute(): ?string
    {
        return $this->created_at?->toIso8601String();
    }

    public const REASONS = [
        'traffic_congestion'   => 'Traffic Congestion',
        'vehicle_breakdown'    => 'Vehicle Breakdown',
        'loading_delay'        => 'Loading Delay',
        'client_site_not_ready'=> 'Client Site Not Ready',
        'weather_condition'    => 'Weather Condition',
        'road_closure'         => 'Road Closure',
        'accident'             => 'Accident',
        'other'                => 'Other',
    ];

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class);
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function acknowledger()
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }
}
