<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Company extends Model
{
    public const STATUS_PENDING = 'pending_activation';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'company_name',
        'company_email',
        'contact_person',
        'contact_number',
        'address',
        'address_street',
        'address_barangay',
        'address_city',
        'address_province',
        'status',
        'activation_token',
        'activation_expires_at',
        'created_by',
    ];

    protected $casts = [
        'activation_expires_at' => 'datetime',
    ];

    protected $hidden = [
        'activation_token',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function companyUsers()
    {
        return $this->hasMany(CompanyUser::class);
    }

    public function users()
    {
        return $this->hasManyThrough(User::class, CompanyUser::class, 'company_id', 'id', 'id', 'user_id');
    }

    public function jobOrders()
    {
        return $this->hasMany(JobOrder::class);
    }

    public function preferences()
    {
        return $this->hasMany(CompanyQuarryVehiclePreference::class);
    }

    public function isPendingActivation(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function issueActivationToken(int $hours = 72): string
    {
        $token = Str::random(64);
        $this->forceFill([
            'activation_token' => $token,
            'activation_expires_at' => now()->addHours($hours),
            'status' => self::STATUS_PENDING,
        ])->save();

        return $token;
    }

    public function clearActivationToken(): void
    {
        $this->forceFill([
            'activation_token' => null,
            'activation_expires_at' => null,
        ])->save();
    }

    /** @deprecated Use company_name */
    public function getClientNameAttribute(): ?string
    {
        return $this->company_name;
    }
}
