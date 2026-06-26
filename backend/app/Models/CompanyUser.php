<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyUser extends Model
{
    public const ROLE_OWNER = 'owner';

    public const ROLE_STAFF = 'staff';

    public const ROLE_VIEWER = 'viewer';

    protected $fillable = [
        'company_id',
        'user_id',
        'role',
        'is_active',
        'force_password_change',
        'last_login',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'force_password_change' => 'boolean',
        'last_login' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isOwner(): bool
    {
        return $this->role === self::ROLE_OWNER;
    }
}
