<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OcrResult extends Model
{
    protected $fillable = [
        'document_id',
        'processing_status',
        'extracted_text',
        'corrected_text',
        'confidence_score',
        'engine',
        'error_message',
        'is_validated',
        'validated_by',
    ];

    protected $casts = [
        'is_validated' => 'boolean',
    ];

    public function document()
    {
        return $this->belongsTo(DeliveryDocument::class, 'document_id');
    }

    public function validator()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }
}
