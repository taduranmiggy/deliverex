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
        'latitude',
        'longitude',
        'captured_at',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
    ];

    public function getEventAtAttribute(): ?string
    {
        return Iso8601::from($this->captured_at);
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }
}
