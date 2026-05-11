<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryDocument extends Model
{
    protected $fillable = [
        'assignment_id',
        'file_path',
        'type',
        'uploaded_by',
        'notes',
    ];

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
}
