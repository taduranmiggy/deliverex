<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    protected $fillable = [
        'vehicle_type_id',
        'plate_no',
        'type',
        'capacity',
        'length_cm',
        'width_cm',
        'height_cm',
        'raw_cbm_value',
        'cbm_capacity',
        'rounded_cbm_capacity',
        'max_weight_kg',
        'max_volume_m3',
        'status',
    ];

    protected $casts = [
        'length_cm' => 'decimal:2',
        'width_cm' => 'decimal:2',
        'height_cm' => 'decimal:2',
        'raw_cbm_value' => 'decimal:3',
        'cbm_capacity' => 'decimal:3',
        'max_weight_kg' => 'decimal:2',
        'max_volume_m3' => 'decimal:3',
    ];

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }

    public function assignments()
    {
        return $this->hasMany(DispatchAssignment::class);
    }

    public function driverAssignments()
    {
        return $this->hasMany(DriverVehicleAssignment::class);
    }
}
