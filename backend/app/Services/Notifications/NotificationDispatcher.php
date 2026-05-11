<?php

namespace App\Services\Notifications;

use App\Models\DispatchAssignment;
use App\Models\NotificationLog;
use App\Models\User;

class NotificationDispatcher
{
    public function notifyUser(?User $user, string $title, string $message): void
    {
        if (! $user) {
            return;
        }

        NotificationLog::query()->create([
            'user_id' => $user->id,
            'title' => $title,
            'message' => $message,
            'is_read' => false,
        ]);
    }

    public function assignmentCreated(DispatchAssignment $assignment): void
    {
        $assignment->loadMissing('driver.user', 'jobOrder');
        $job = $assignment->jobOrder;
        $code = $job?->tracking_code ?? (string) $job?->id;

        $this->notifyUser(
            $assignment->driver?->user,
            'New delivery assignment',
            'You have been assigned job '.$code.'. Open the driver app for route and status updates.'
        );
    }
}
