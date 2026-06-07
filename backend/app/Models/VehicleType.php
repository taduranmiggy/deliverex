<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VehicleType extends Model
{
    protected $fillable = [
        'name',
        'wheel_type',
        'min_cbm',
        'max_cbm',
        'description',
        'status',
    ];

    protected $casts = [
        'min_cbm' => 'decimal:3',
        'max_cbm' => 'decimal:3',
    ];

    public function vehicles()
    {
        return $this->hasMany(Vehicle::class);
    }
}
