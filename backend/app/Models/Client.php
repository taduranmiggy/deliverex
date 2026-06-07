<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    protected $fillable = [
        'client_name',
        'contact_person',
        'email',
        'phone',
        'address',
        'status',
    ];

    public function preferences()
    {
        return $this->hasMany(ClientQuarryVehiclePreference::class);
    }
}
