<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'created_by',
        'customer_user_id',
        'tracking_code',
        'customer_name',
        'customer_email',
        'customer_contact',
        'pickup_location',
        'dropoff_location',
        'job_requirements',
        'vehicle_type_required',
        'vehicle_capacity_required',
        'weight_kg',
        'volume_m3',
        'scheduled_start',
        'scheduled_end',
        'priority',
        'status',
    ];

    protected $casts = [
        'weight_kg' => 'decimal:2',
        'volume_m3' => 'decimal:3',
        'scheduled_start' => 'datetime',
        'scheduled_end' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function customerAccount()
    {
        return $this->belongsTo(User::class, 'customer_user_id');
    }

    public function assignments()
    {
        return $this->hasMany(DispatchAssignment::class);
    }
}
