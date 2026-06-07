<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryStatusLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'assignment_id',
        'status',
        'notes',
        'latitude',
        'longitude',
        'arrival_verified',
        'created_at',
    ];

    protected $casts = [
        'latitude'         => 'float',
        'longitude'        => 'float',
        'arrival_verified'=> 'boolean',
        'created_at'       => 'datetime',
    ];

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }
}
