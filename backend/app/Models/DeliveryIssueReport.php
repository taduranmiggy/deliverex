<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryIssueReport extends Model
{
    public $timestamps = false;

    protected $appends = [
        'reported_event_at',
    ];

    protected $fillable = [
        'assignment_id',
        'driver_id',
        'reported_by',
        'issue_type',
        'notes',
        'photo_path',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public const TYPES = [
        'vehicle_breakdown'  => 'Vehicle Breakdown',
        'flat_tire'          => 'Flat Tire',
        'accident'           => 'Accident',
        'wrong_material'     => 'Wrong Material',
        'site_inaccessible'  => 'Site Inaccessible',
        'safety_issue'       => 'Safety Issue',
        'other'              => 'Other',
    ];

    /** @deprecated Legacy labels for records created before category refresh */
    public const LEGACY_TYPES = [
        'customer_unavailable' => 'Customer Unavailable',
        'wrong_address'        => 'Wrong Address',
        'access_denied'        => 'Access Denied / Gate Closed',
        'traffic_delay'        => 'Traffic / Road Delay',
        'vehicle_problem'      => 'Vehicle Problem',
        'package_damaged'      => 'Package Damaged',
    ];

    public function getReportedEventAtAttribute(): ?string
    {
        return $this->created_at?->toIso8601String();
    }

    public static function typeLabel(string $type): string
    {
        return self::TYPES[$type] ?? self::LEGACY_TYPES[$type] ?? $type;
    }

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
