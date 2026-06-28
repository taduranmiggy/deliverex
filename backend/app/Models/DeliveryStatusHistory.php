<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryStatusHistory extends Model
{
    protected $table = 'delivery_status_history';

    public $timestamps = false;

    protected $fillable = [
        'job_order_id',
        'assignment_id',
        'status',
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
}
