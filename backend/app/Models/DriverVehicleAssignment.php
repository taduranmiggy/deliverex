<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DriverVehicleAssignment extends Model
{
    protected $fillable = [
        'driver_id',
        'vehicle_id',
        'is_primary',
        'status',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
    ];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }
}
