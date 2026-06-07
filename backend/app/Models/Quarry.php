<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quarry extends Model
{
    protected $fillable = [
        'quarry_name',
        'contact_person',
        'email',
        'phone',
        'address',
        'status',
    ];

    public function clientPreferences()
    {
        return $this->hasMany(ClientQuarryVehiclePreference::class);
    }
}
