<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Driver extends Model
{
    protected $fillable = [
        'user_id',
        'full_name',
        'license_no',
        'license_expiry',
        'availability',
        'status',
        'current_assignment_id',
        'address',
        'address_street',
        'address_barangay',
        'address_city',
        'address_province',
        'address_region',
        'address_region_code',
        'address_province_code',
        'address_city_code',
        'address_barangay_code',
        'address_latitude',
        'address_longitude',
        'address_geocode_attempted_at',
        'address_geocoding_trace_id',
        'address_coordinate_source',
        'address_coordinate_provider',
        'address_coordinate_place_id',
        'address_coordinate_label',
        'address_coordinate_confirmed_at',
    ];

    protected $casts = [
        'license_expiry' => 'date',
        'address_latitude' => 'float',
        'address_longitude' => 'float',
        'address_geocode_attempted_at' => 'datetime',
        'address_coordinate_confirmed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assignments()
    {
        return $this->hasMany(DispatchAssignment::class);
    }

    public function vehicleAssignments()
    {
        return $this->hasMany(DriverVehicleAssignment::class);
    }

    public function currentAssignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'current_assignment_id');
    }

    public function isLicenseEligible(): bool
    {
        return \App\Support\DriverLicenseValidator::isEligible($this);
    }

    /** @return array{eligible:bool,license_status:string,license_no:?string,license_expiry:?string,message:?string} */
    public function licenseSummary(): array
    {
        return \App\Support\DriverLicenseValidator::summary($this);
    }
}
