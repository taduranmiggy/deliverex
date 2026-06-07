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
    ];

    protected $casts = [
        'license_expiry' => 'date',
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
}
