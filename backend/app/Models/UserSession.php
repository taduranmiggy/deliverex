<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Application session row (spec: sessions).
 * Tracks each login/device context for JWT refresh lifecycle.
 */
class UserSession extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'device_id',
        'device_label',
        'platform',
        'ip_address',
        'user_agent',
        'last_active_at',
        'is_active',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'last_active_at' => 'datetime',
            'revoked_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class);
    }

    public function activeRefreshToken(): HasOne
    {
        return $this->hasOne(RefreshToken::class)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->latest('id');
    }

    public function driverDeviceSession(): HasOne
    {
        return $this->hasOne(DriverDeviceSession::class);
    }

    public function isRevoked(): bool
    {
        return ! $this->is_active || $this->revoked_at !== null;
    }
}
