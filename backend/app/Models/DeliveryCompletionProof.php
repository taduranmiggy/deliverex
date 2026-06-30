<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryCompletionProof extends Model
{
    public $timestamps = false;

    public const TYPE_RECEIPT_PHOTO = 'receipt_photo';
    public const TYPE_OCR_DOCUMENT  = 'ocr_document';

    public const TYPES = [
        self::TYPE_RECEIPT_PHOTO => 'Delivery Receipt Photo',
        self::TYPE_OCR_DOCUMENT  => 'OCR Document Upload',
    ];

    protected $appends = [
        'submitted_event_at',
    ];

    protected $fillable = [
        'job_order_id',
        'assignment_id',
        'driver_id',
        'reported_by',
        'proof_type',
        'delivery_document_id',
        'receiver_name',
        'receiver_contact',
        'receiver_signature_path',
        'delivery_notes',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function getSubmittedEventAtAttribute(): ?string
    {
        return $this->created_at?->toIso8601String();
    }

    public function jobOrder()
    {
        return $this->belongsTo(JobOrder::class);
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

    public function deliveryDocument()
    {
        return $this->belongsTo(DeliveryDocument::class, 'delivery_document_id');
    }
}
