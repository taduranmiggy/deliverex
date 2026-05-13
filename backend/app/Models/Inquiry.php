<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inquiry extends Model
{
    protected $fillable = [
        'name',
        'email',
        'phone',
        'pickup_location',
        'dropoff_location',
        'message',
        'status',
        'job_order_id',
    ];

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class);
    }
}
