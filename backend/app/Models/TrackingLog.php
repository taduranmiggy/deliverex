<?php

namespace App\Models;

use App\Support\Iso8601;
use Illuminate\Database\Eloquent\Model;

class TrackingLog extends Model
{
    public $timestamps = false;

    protected $appends = [
        'event_at',
    ];

    protected $fillable = [
        'assignment_id',
        'driver_id',
        'latitude',
        'longitude',
        'accuracy_m',
        'heading',
        'speed_kmh',
        'battery_level',
        'source',
        'captured_at',
        'synced_at',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
        'synced_at' => 'datetime',
        'latitude' => 'float',
        'longitude' => 'float',
        'accuracy_m' => 'float',
        'heading' => 'float',
        'speed_kmh' => 'float',
        'battery_level' => 'integer',
    ];

    public function getEventAtAttribute(): ?string
    {
        return Iso8601::from($this->captured_at);
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }
}
