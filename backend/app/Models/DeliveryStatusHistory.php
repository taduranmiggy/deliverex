<?php

namespace App\Models;

use App\Support\Iso8601;
use Illuminate\Database\Eloquent\Model;

class DeliveryStatusHistory extends Model
{
    protected $table = 'delivery_status_history';

    public $timestamps = false;

    protected $appends = [
        'event_at',
    ];

    protected $fillable = [
        'job_order_id',
        'assignment_id',
        'driver_id',
        'status',
        'previous_status',
        'updated_by',
        'updated_at',
        'latitude',
        'longitude',
        'remarks',
        'created_at',
    ];

    protected $casts = [
        'updated_at' => 'datetime',
        'created_at' => 'datetime',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    public function getEventAtAttribute(): ?string
    {
        return Iso8601::from($this->updated_at);
    }
}
