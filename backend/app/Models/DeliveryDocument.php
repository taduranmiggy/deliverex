<?php

namespace App\Models;

use App\Support\Iso8601;
use Illuminate\Database\Eloquent\Model;

class DeliveryDocument extends Model
{
    public $timestamps = false;

    protected $appends = [
        'uploaded_event_at',
    ];

    protected $fillable = [
        'assignment_id',
        'file_path',
        'type',
        'uploaded_by',
        'notes',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function getUploadedEventAtAttribute(): ?string
    {
        return Iso8601::from($this->created_at);
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
