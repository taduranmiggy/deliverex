<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncConflict extends Model
{
    protected $fillable = [
        'user_id',
        'action_type',
        'entity_type',
        'entity_id',
        'server_version',
        'client_version',
        'changed_fields',
        'resolution',
        'client_action_at',
        'resolved_at',
    ];

    protected $casts = [
        'server_version' => 'array',
        'client_version' => 'array',
        'changed_fields' => 'array',
        'client_action_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
