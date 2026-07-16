<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DriverLocationHistory extends Model
{
    public $timestamps = false;

    protected $table = 'driver_location_history';

    protected $fillable = [
        'driver_id',
        'assignment_id',
        'job_order_id',
        'latitude',
        'longitude',
        'speed_kmh',
        'heading',
        'accuracy_m',
        'battery_level',
        'captured_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'speed_kmh' => 'float',
        'heading' => 'float',
        'accuracy_m' => 'float',
        'battery_level' => 'integer',
        'captured_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class, 'job_order_id');
    }
}
