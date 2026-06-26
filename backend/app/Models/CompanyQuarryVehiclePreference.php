<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyQuarryVehiclePreference extends Model
{
    protected $table = 'company_quarry_vehicle_preferences';

    protected $fillable = [
        'company_id',
        'quarry_id',
        'vehicle_type_id',
        'is_default',
        'status',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
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
