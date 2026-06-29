<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrackingLog extends Model
{
    public $timestamps = false;

    protected $appends = [
        'event_at',
    ];

    protected $fillable = [
        'assignment_id',
        'latitude',
        'longitude',
        'captured_at',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
    ];

    public function getEventAtAttribute(): ?string
    {
        return $this->captured_at?->toIso8601String();
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }
}
