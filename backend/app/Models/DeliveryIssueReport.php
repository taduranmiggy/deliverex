<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryIssueReport extends Model
{
    protected $fillable = [
        'assignment_id',
        'driver_id',
        'reported_by',
        'issue_type',
        'notes',
    ];

    public const TYPES = [
        'customer_unavailable' => 'Customer Unavailable',
        'wrong_address'        => 'Wrong Address',
        'access_denied'        => 'Access Denied / Gate Closed',
        'traffic_delay'        => 'Traffic / Road Delay',
        'vehicle_problem'      => 'Vehicle Problem',
        'package_damaged'      => 'Package Damaged',
        'other'                => 'Other Issue',
    ];

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }
}
