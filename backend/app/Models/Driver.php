<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Driver extends Model
{
    protected $fillable = [
        'user_id',
        'license_no',
        'availability',
        'current_assignment_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assignments()
    {
        return $this->hasMany(DispatchAssignment::class);
    }

    public function currentAssignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'current_assignment_id');
    }
}
