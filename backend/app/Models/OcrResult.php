<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OcrResult extends Model
{
    protected $fillable = [
        'document_id',
        'processing_status',
        'review_status',
        'extracted_text',
        'corrected_text',
        'extracted_length',
        'extracted_width',
        'extracted_height',
        'extracted_volume',
        'delivery_receipt_number',
        'assignment_id',
        'job_order_id',
        'driver_id',
        'driver_name',
        'vehicle_plate_no',
        'delivery_date',
        'confidence_score',
        'engine',
        'ocr_diagnostics',
        'error_message',
        'review_notes',
        'reviewed_at',
        'is_validated',
        'validated_by',
    ];

    protected $casts = [
        'is_validated' => 'boolean',
        'reviewed_at' => 'datetime',
        'delivery_date' => 'datetime',
        'extracted_length' => 'float',
        'extracted_width' => 'float',
        'extracted_height' => 'float',
        'extracted_volume' => 'float',
        'ocr_diagnostics' => 'array',
    ];

    public function document()
    {
        return $this->belongsTo(DeliveryDocument::class, 'document_id');
    }

    public function validator()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class, 'job_order_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }
}
