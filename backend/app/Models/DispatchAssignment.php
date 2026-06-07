<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DispatchAssignment extends Model
{
    protected $fillable = [
        'job_order_id',
        'driver_id',
        'vehicle_id',
        'assigned_by',
        'status',
        'assigned_at',
        'started_at',
        'completed_at',
        'pod_verified_at',
        'pod_verified_by',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'pod_verified_at' => 'datetime',
    ];

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function podVerifiedBy()
    {
        return $this->belongsTo(User::class, 'pod_verified_by');
    }

    public function deliveryStatusLogs()
    {
        return $this->hasMany(DeliveryStatusLog::class, 'assignment_id');
    }

    public function trackingLogs()
    {
        return $this->hasMany(TrackingLog::class, 'assignment_id');
    }

    public function deliveryDocuments()
    {
        return $this->hasMany(DeliveryDocument::class, 'assignment_id');
    }

    public function issueReports()
    {
        return $this->hasMany(DeliveryIssueReport::class, 'assignment_id');
    }

    public function delayReports()
    {
        return $this->hasMany(DeliveryDelayReport::class, 'assignment_id');
    }

    public function latestDelayReport()
    {
        return $this->hasOne(DeliveryDelayReport::class, 'assignment_id')->latestOfMany();
    }

    public function latestArrivedStatusLog()
    {
        return $this->hasOne(DeliveryStatusLog::class, 'assignment_id')
            ->where('status', 'arrived')
            ->latestOfMany('created_at');
    }

    public function completionProof()
    {
        return $this->hasOne(DeliveryCompletionProof::class, 'assignment_id');
    }

    public function auditTrail()
    {
        return $this->hasOne(AssignmentAuditTrail::class, 'assignment_id');
    }
}
