<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientQuarryVehiclePreference extends Model
{
    protected $fillable = [
        'client_id',
        'quarry_id',
        'vehicle_type_id',
        'is_default',
        'status',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function quarry()
    {
        return $this->belongsTo(Quarry::class);
    }

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }
}
