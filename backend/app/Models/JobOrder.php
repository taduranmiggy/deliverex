<?php

namespace App\Models;

use App\Support\JobOrderScheduleValidator;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class JobOrder extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::saving(function (JobOrder $jobOrder) {
            if ($jobOrder->isDirty('scheduled_start') && $jobOrder->scheduled_start) {
                if (JobOrderScheduleValidator::isPast($jobOrder->scheduled_start)) {
                    throw ValidationException::withMessages([
                        'scheduled_start' => [JobOrderScheduleValidator::MESSAGE],
                    ]);
                }
            }

            if ($jobOrder->isDirty('scheduled_end') && $jobOrder->scheduled_end) {
                if (JobOrderScheduleValidator::isPast($jobOrder->scheduled_end)) {
                    throw ValidationException::withMessages([
                        'scheduled_end' => [JobOrderScheduleValidator::MESSAGE],
                    ]);
                }
            }
        });
    }

    protected $fillable = [
        'created_by',
        'customer_user_id',
        'tracking_code',
        'customer_name',
        'customer_email',
        'customer_contact',
        'pickup_location',
        'dropoff_location',
        'delivery_type',
        'job_requirements',
        'notes',
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
