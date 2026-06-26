<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR 1.19 — binds a driver user to a single active device session. */
class DriverDeviceSession extends Model
{
    protected $fillable = [
        'driver_user_id',
        'user_session_id',
        'device_id',
        'refresh_token_id',
        'last_active_at',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'last_active_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function driverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_user_id');
    }

    public function userSession(): BelongsTo
    {
        return $this->belongsTo(UserSession::class);
    }

    public function refreshToken(): BelongsTo
    {
        return $this->belongsTo(RefreshToken::class);
    }
}
