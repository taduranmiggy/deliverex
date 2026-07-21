<?php

namespace App\Models;

use App\Support\JobOrderAddressFormatter;
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
        'company_id',
        'custom_client_name',
        'customer_email',
        'customer_contact',
        // legacy combined location fields kept for backward compat — auto-populated from parts
        'pickup_location',
        'dropoff_location',
        // structured pickup address
        'pickup_region_code',
        'pickup_region',
        'pickup_province_code',
        'pickup_province',
        'pickup_city_code',
        'pickup_city',
        'pickup_barangay_code',
        'pickup_barangay',
        'pickup_street',
        'pickup_landmark',
        'pickup_formatted_address',
        'pickup_latitude',
        'pickup_longitude',
        'pickup_geocode_attempted_at',
        'pickup_geocoding_trace_id',
        'pickup_coordinate_source',
        'pickup_coordinate_provider',
        'pickup_coordinate_place_id',
        'pickup_coordinate_label',
        'pickup_coordinate_confirmed_at',
        // structured drop-off address
        'dropoff_region_code',
        'dropoff_region',
        'dropoff_province_code',
        'dropoff_province',
        'dropoff_city_code',
        'dropoff_city',
        'dropoff_barangay_code',
        'dropoff_barangay',
        'dropoff_street',
        'dropoff_landmark',
        'dropoff_formatted_address',
        'dropoff_latitude',
        'dropoff_longitude',
        'dropoff_geocode_attempted_at',
        'dropoff_geocoding_trace_id',
        'dropoff_coordinate_source',
        'dropoff_coordinate_provider',
        'dropoff_coordinate_place_id',
        'dropoff_coordinate_label',
        'dropoff_coordinate_confirmed_at',
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
        'is_archived',
        'archived_at',
    ];

    /**
     * Return a display-ready full name from structured parts, falling back to
     * the legacy customer_name field for records created before the migration.
     */
    public function getDisplayNameAttribute(): string
    {
        if ($this->relationLoaded('company') && $this->company?->company_name) {
            return $this->company->company_name;
        }
        if ($this->company_id && $this->company?->company_name) {
            return $this->company->company_name;
        }
        if ($this->relationLoaded('client') && $this->client?->company_name) {
            return $this->client->company_name;
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
        if (trim((string) $this->pickup_formatted_address) !== '') {
            return trim((string) $this->pickup_formatted_address);
        }

        return JobOrderAddressFormatter::displayFromStructured(
            $this->pickup_street,
            $this->pickup_barangay,
            $this->pickup_city,
            $this->pickup_province,
            $this->pickup_location,
        );
    }

    /**
     * Return a display-ready drop-off address from structured parts, falling
     * back to the legacy dropoff_location field.
     */
    public function getDisplayDropoffAttribute(): string
    {
        if (trim((string) $this->dropoff_formatted_address) !== '') {
            return trim((string) $this->dropoff_formatted_address);
        }

        return JobOrderAddressFormatter::displayFromStructured(
            $this->dropoff_street,
            $this->dropoff_barangay,
            $this->dropoff_city,
            $this->dropoff_province,
            $this->dropoff_location,
        );
    }

    protected $casts = [
        'weight_kg' => 'decimal:2',
        'volume_m3' => 'decimal:3',
        'load_volume_m3' => 'decimal:3',
        'scheduled_start' => 'datetime',
        'scheduled_end' => 'datetime',
        'pickup_latitude' => 'float',
        'pickup_longitude' => 'float',
        'dropoff_latitude' => 'float',
        'dropoff_longitude' => 'float',
        'pickup_geocode_attempted_at' => 'datetime',
        'dropoff_geocode_attempted_at' => 'datetime',
        'pickup_coordinate_confirmed_at' => 'datetime',
        'dropoff_coordinate_confirmed_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    /** @deprecated Use company_id */
    public function getClientIdAttribute(): ?int
    {
        return isset($this->attributes['company_id']) ? (int) $this->attributes['company_id'] : null;
    }

    /** @deprecated Use company_id */
    public function setClientIdAttribute($value): void
    {
        $this->attributes['company_id'] = $value;
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function customerAccount()
    {
        return $this->belongsTo(User::class, 'customer_user_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /** @deprecated Use company() */
    public function client()
    {
        return $this->company();
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
