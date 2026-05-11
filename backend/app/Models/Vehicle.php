<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    protected $fillable = [
        'plate_no',
        'type',
        'capacity',
        'max_weight_kg',
        'max_volume_m3',
        'status',
    ];

    public function assignments()
    {
        return $this->hasMany(DispatchAssignment::class);
    }
}
