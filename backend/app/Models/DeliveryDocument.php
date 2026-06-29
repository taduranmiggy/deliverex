<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryDocument extends Model
{
    protected $appends = [
        'uploaded_event_at',
    ];

    protected $fillable = [
        'assignment_id',
        'file_path',
        'type',
        'uploaded_by',
        'notes',
    ];

    public function getUploadedEventAtAttribute(): ?string
    {
        return $this->created_at?->toIso8601String();
    }

    public function assignment()
    {
        return $this->belongsTo(DispatchAssignment::class, 'assignment_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function ocrResult()
    {
        return $this->hasOne(OcrResult::class, 'document_id');
    }

    public function completionProof()
    {
        return $this->hasOne(DeliveryCompletionProof::class, 'delivery_document_id');
    }
}
