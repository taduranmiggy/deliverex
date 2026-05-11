<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogger
{
    public static function record(?User $user, string $action, ?string $subjectType, ?int $subjectId, array $metadata = [], ?Request $request = null): void
    {
        AuditLog::query()->create([
            'user_id' => $user?->id,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'metadata' => $metadata ?: null,
            'ip_address' => $request?->ip(),
        ]);
    }
}
