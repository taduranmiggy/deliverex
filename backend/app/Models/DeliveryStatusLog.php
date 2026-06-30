<?php

namespace App\Models;

use App\Support\Iso8601;
use Illuminate\Database\Eloquent\Model;

class DeliveryStatusLog extends Model
{
    public $timestamps = false;

    protected $appends = [
        'event_at',
        'performed_offline',
    ];

    protected $fillable = [
        'assignment_id',
        'status',
        'notes',
        'latitude',
        'longitude',
        'arrival_verified',
        'created_at',
        'synced_at',
    ];

    protected $casts = [
        'latitude'         => 'float',
        'longitude'        => 'float',
        'arrival_verified'=> 'boolean',
        'created_at'       => 'datetime',
        'synced_at'        => 'datetime',
    ];

    public function getEventAtAttribute(): ?string
    {
        return Iso8601::from($this->created_at);
    }

    public function getPerformedOfflineAttribute(): bool
    {
        return $this->synced_at !== null;
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }
}
