<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssignmentAuditTrail extends Model
{
    protected $fillable = [
        'assignment_id',
        'job_order_id',
        'dispatcher_id',
        'recommended_driver_id',
        'recommended_vehicle_id',
        'recommended_driver_name',
        'recommended_vehicle_plate',
        'assigned_driver_id',
        'assigned_vehicle_id',
        'assigned_driver_name',
        'assigned_vehicle_plate',
        'is_override',
        'override_reason',
        'best_fit_score',
        'best_fit_reasons',
    ];

    protected $casts = [
        'is_override'      => 'boolean',
        'best_fit_score'   => 'float',
        'best_fit_reasons' => 'array',
    ];

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class);
    }

    public function dispatcher()
    {
        return $this->belongsTo(User::class, 'dispatcher_id');
    }

    public function recommendedDriver()
    {
        return $this->belongsTo(Driver::class, 'recommended_driver_id');
    }

    public function recommendedVehicle()
    {
        return $this->belongsTo(Vehicle::class, 'recommended_vehicle_id');
    }

    public function assignedDriver()
    {
        return $this->belongsTo(Driver::class, 'assigned_driver_id');
    }

    public function assignedVehicle()
    {
        return $this->belongsTo(Vehicle::class, 'assigned_vehicle_id');
    }
}
