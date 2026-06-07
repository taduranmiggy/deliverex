<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inquiry extends Model
{
    protected $fillable = [
        'name',
        'email',
        'phone',
        'inquiry_type',
        'reference_job_order_id',
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

    public function referenceJobOrder()
    {
        return $this->belongsTo(JobOrder::class, 'reference_job_order_id');
    }
}
