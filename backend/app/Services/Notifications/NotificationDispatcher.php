<?php

namespace App\Services\Notifications;

use App\Models\DeliveryDelayReport;
use App\Models\DeliveryDocument;
use App\Models\DeliveryIssueReport;
use App\Models\DispatchAssignment;
use App\Models\NotificationLog;
use App\Models\OcrResult;
use App\Models\Role;
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
            'title'   => $title,
            'message' => $message,
            'is_read' => false,
        ]);
    }

    public function notifyRole(string $roleName, string $title, string $message): void
    {
        $role = Role::where('name', $roleName)->first();
        if (! $role) {
            return;
        }

        User::where('role_id', $role->id)
            ->where('status', 'active')
            ->each(fn (User $user) => $this->notifyUser($user, $title, $message));
    }

    public function assignmentCreated(DispatchAssignment $assignment): void
    {
        $assignment->loadMissing('driver.user', 'jobOrder', 'assignedBy');
        $job  = $assignment->jobOrder;
        $code = $job?->tracking_code ?? (string) $job?->id;

        $this->notifyUser(
            $assignment->driver?->user,
            'New delivery assignment',
            'You have been assigned job '.$code.'. Open the driver app for route and status updates.'
        );

        $this->notifyUser(
            $assignment->assignedBy,
            'Assignment confirmed',
            'Job '.$code.' assigned to '.($assignment->driver?->user?->name ?? 'driver').'.'
        );
    }

    public function statusUpdated(DispatchAssignment $assignment, string $status): void
    {
        $assignment->loadMissing('assignedBy', 'jobOrder', 'driver.user');
        $job  = $assignment->jobOrder;
        $code = $job?->tracking_code ?? (string) $job?->id;
        $label = str_replace('_', ' ', $status);

        $this->notifyUser(
            $assignment->assignedBy,
            'Delivery status update',
            'Job '.$code.' updated to '.$label.'.'
        );

        if ($job && $job->customerAccount) {
            $this->notifyUser(
                $job->customerAccount,
                'Delivery status update',
                'Your delivery '.$code.' is now '.$label.'.'
            );
        }

        $this->notifyRole(
            'manager',
            'Delivery status update',
            'Job '.$code.' ('.($assignment->driver?->user?->name ?? 'driver').') is now '.$label.'.'
        );
    }

    public function deliveryCompleted(DispatchAssignment $assignment): void
    {
        $assignment->loadMissing('assignedBy', 'jobOrder', 'driver.user');
        $job  = $assignment->jobOrder;
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

        $this->notifyRole('manager', 'Delivery completed', 'Job '.$code.' has been completed.');
        $this->notifyRole('admin', 'Delivery completed', 'Job '.$code.' has been completed.');
    }

    public function documentUploaded(DeliveryDocument $document): void
    {
        $document->loadMissing('assignment.jobOrder', 'assignment.driver.user');
        $assignment = $document->assignment;
        $job        = $assignment?->jobOrder;
        $code       = $job?->tracking_code ?? (string) $job?->id;

        $this->notifyUser(
            $assignment?->assignedBy,
            'Document uploaded',
            'New '.($document->type ?? 'document').' uploaded for job '.$code.'. OCR processing started.'
        );

        $this->notifyRole(
            'admin',
            'Document awaiting OCR review',
            'A '.($document->type ?? 'document').' was uploaded for job '.$code.' and is queued for review.'
        );
    }

    public function issueReported(DeliveryIssueReport $report): void
    {
        $report->loadMissing('assignment.jobOrder', 'assignment.assignedBy', 'driver.user');
        $assignment = $report->assignment;
        $job        = $assignment?->jobOrder;
        $code       = $job?->tracking_code ?? (string) $job?->id;
        $label      = DeliveryIssueReport::typeLabel($report->issue_type);
        $driverName = $report->driver?->user?->name ?? 'Driver';

        $message = $driverName.' reported "'.$label.'" for job '.$code.'.';
        if ($report->notes) {
            $message .= ' Notes: '.$report->notes;
        }

        if ($report->photo_path) {
            $message .= ' Photo attached.';
        }

        $this->notifyUser($assignment?->assignedBy, 'Driver issue report', $message);
        $this->notifyRole('admin', 'Driver issue report', $message);
        $this->notifyRole('dispatcher', 'Driver issue report', $message);
        $this->notifyRole('manager', 'Driver issue report', $message);
    }

    public function delayReported(DeliveryDelayReport $report): void
    {
        $report->loadMissing('assignment.jobOrder', 'assignment.assignedBy', 'driver.user');
        $assignment = $report->assignment;
        $job        = $assignment?->jobOrder;
        $code       = $job?->tracking_code ?? (string) $job?->id;
        $label      = DeliveryDelayReport::REASONS[$report->delay_reason] ?? $report->delay_reason;
        $driverName = $report->driver?->user?->name ?? 'Driver';

        $message = $driverName.' reported delivery delay: "'.$label.'" for job '.$code.'.';
        if ($report->delay_notes) {
            $message .= ' Notes: '.$report->delay_notes;
        }

        $this->notifyUser($assignment?->assignedBy, 'Delivery delay report', $message);
        $this->notifyRole('admin', 'Delivery delay report', $message);
        $this->notifyRole('dispatcher', 'Delivery delay report', $message);
        $this->notifyRole('manager', 'Delivery delay report', $message);
    }

    public function ocrValidated(OcrResult $ocrResult, string $action): void
    {
        $ocrResult->loadMissing('document.assignment.jobOrder', 'document.assignment.driver.user');
        $document   = $ocrResult->document;
        $assignment = $document?->assignment;
        $job        = $assignment?->jobOrder;
        $code       = $job?->tracking_code ?? (string) $job?->id;

        if ($action === 'approve') {
            $this->notifyUser(
                $assignment?->assignedBy,
                'OCR document validated',
                'Document for job '.$code.' was approved by admin.'
            );
            $this->notifyUser(
                $assignment?->driver?->user,
                'Proof of delivery verified',
                'Your uploaded document for job '.$code.' was validated.'
            );
        } elseif ($action === 'reject') {
            $this->notifyUser(
                $assignment?->driver?->user,
                'Document rejected',
                'Uploaded document for job '.$code.' was rejected. Please re-upload if required.'
            );
        }
    }
}
