<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Server-side offline queue mirror (FR 1.20). */
class OfflineSyncQueue extends Model
{
    protected $table = 'offline_sync_queue';

    protected $fillable = [
        'user_id',
        'device_id',
        'client_queue_id',
        'action_type',
        'payload',
        'action_timestamp',
        'status',
        'last_error',
        'attempt_count',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'action_timestamp' => 'datetime',
            'synced_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
