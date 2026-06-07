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
        // legacy combined field kept for backward compat — auto-populated from parts
        'customer_name',
        // structured name parts
        'customer_first_name',
        'customer_middle_name',
        'customer_last_name',
        'customer_suffix',
        'client_id',
        'custom_client_name',
        'customer_email',
        'customer_contact',
        // legacy combined location fields kept for backward compat — auto-populated from parts
        'pickup_location',
        'dropoff_location',
        // structured pickup address
        'pickup_province',
        'pickup_city',
        'pickup_barangay',
        'pickup_street',
        'pickup_landmark',
        // structured drop-off address
        'dropoff_province',
        'dropoff_city',
        'dropoff_barangay',
        'dropoff_street',
        'dropoff_landmark',
        'dropoff_latitude',
        'dropoff_longitude',
        'quarry_id',
        'preferred_vehicle_type_id',
        'delivery_type',
        'material_type',
        'material_type_id',
        'specification_size',
        'material_specification_id',
        'job_requirements',
        'special_handling_instructions',
        'notes',
        'vehicle_type_required',
        'vehicle_capacity_required',
        'weight_kg',
        'volume_m3',
        'load_volume_m3',
        'scheduled_start',
        'scheduled_end',
        'priority',
        'status',
    ];

    /**
     * Return a display-ready full name from structured parts, falling back to
     * the legacy customer_name field for records created before the migration.
     */
    public function getDisplayNameAttribute(): string
    {
        if ($this->relationLoaded('client') && $this->client?->client_name) {
            return $this->client->client_name;
        }
        if ($this->client_id && $this->client?->client_name) {
            return $this->client->client_name;
        }
        if ($this->custom_client_name) {
            return $this->custom_client_name;
        }
        if ($this->customer_first_name || $this->customer_last_name) {
            $parts = array_filter([
                $this->customer_first_name,
                $this->customer_middle_name,
                $this->customer_last_name,
                $this->customer_suffix,
            ]);
            return implode(' ', $parts);
        }
        return $this->customer_name ?? '';
    }

    /**
     * Return a display-ready pickup address from structured parts, falling back
     * to the legacy pickup_location field.
     */
    public function getDisplayPickupAttribute(): string
    {
        if ($this->pickup_street || $this->pickup_city) {
            $parts = array_filter([
                $this->pickup_street,
                $this->pickup_barangay,
                $this->pickup_city,
                $this->pickup_province,
            ]);
            return implode(', ', $parts);
        }
        return $this->pickup_location ?? '';
    }

    /**
     * Return a display-ready drop-off address from structured parts, falling
     * back to the legacy dropoff_location field.
     */
    public function getDisplayDropoffAttribute(): string
    {
        if ($this->dropoff_street || $this->dropoff_city) {
            $parts = array_filter([
                $this->dropoff_street,
                $this->dropoff_barangay,
                $this->dropoff_city,
                $this->dropoff_province,
            ]);
            return implode(', ', $parts);
        }
        return $this->dropoff_location ?? '';
    }

    protected $casts = [
        'weight_kg' => 'decimal:2',
        'volume_m3' => 'decimal:3',
        'load_volume_m3' => 'decimal:3',
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

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function quarry()
    {
        return $this->belongsTo(Quarry::class);
    }

    public function preferredVehicleType()
    {
        return $this->belongsTo(VehicleType::class, 'preferred_vehicle_type_id');
    }

    public function materialTypeRef()
    {
        return $this->belongsTo(MaterialType::class, 'material_type_id');
    }

    public function materialSpecification()
    {
        return $this->belongsTo(MaterialSpecification::class, 'material_specification_id');
    }

    public function assignments()
    {
        return $this->hasMany(DispatchAssignment::class);
    }
}
