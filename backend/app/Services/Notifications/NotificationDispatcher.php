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

    public function statusUpdated(DispatchAssignment $assignment, string $status): void
    {
        $assignment->loadMissing('assignedBy', 'jobOrder');
        $job = $assignment->jobOrder;
        $code = $job?->tracking_code ?? (string) $job?->id;

        $this->notifyUser(
            $assignment->assignedBy,
            'Delivery status update',
            'Job '.$code.' updated to '.$status.'.'
        );

        if ($job && $job->customerAccount) {
            $this->notifyUser(
                $job->customerAccount,
                'Delivery status update',
                'Your delivery '.$code.' is now '.$status.'.'
            );
        }
    }

    public function deliveryCompleted(DispatchAssignment $assignment): void
    {
        $assignment->loadMissing('assignedBy', 'jobOrder');
        $job = $assignment->jobOrder;
        $code = $job?->tracking_code ?? (string) $job?->id;

        $this->notifyUser(
            $assignment->assignedBy,
            'Delivery completed',
            'Job '.$code.' has been completed.'
        );

        if ($job && $job->customerAccount) {
            $this->notifyUser(
                $job->customerAccount,
                'Delivery completed',
                'Your delivery '.$code.' is completed. Proof of delivery is available if provided.'
            );
        }
    }
}
