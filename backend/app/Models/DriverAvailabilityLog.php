<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DriverAvailabilityLog extends Model
{
    protected $fillable = [
        'driver_id',
        'previous_availability',
        'new_availability',
        'reason',
        'previous_assignment_id',
        'current_assignment_id',
        'active_assignment_count',
        'triggered_by_user_id',
    ];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function triggeredBy()
    {
        return $this->belongsTo(User::class, 'triggered_by_user_id');
    }
}
