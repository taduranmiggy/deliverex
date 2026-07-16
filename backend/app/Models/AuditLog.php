<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'role_name',
        'action',
        'module',
        'subject_type',
        'subject_id',
        'metadata',
        'changes',
        'ip_address',
        'user_agent',
        'session_id',
    ];

    protected $casts = [
        'metadata' => 'array',
        'changes' => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
