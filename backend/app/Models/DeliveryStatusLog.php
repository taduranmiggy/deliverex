<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryStatusLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'assignment_id',
        'status',
        'notes',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }
}
