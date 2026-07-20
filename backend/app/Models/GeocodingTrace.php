<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GeocodingTrace extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $casts = [
        'request_payload' => 'array',
        'response_payload' => 'array',
        'candidates' => 'array',
        'selected_candidate' => 'array',
        'selected_latitude' => 'float',
        'selected_longitude' => 'float',
        'stored_latitude' => 'float',
        'stored_longitude' => 'float',
        'api_latitude' => 'float',
        'api_longitude' => 'float',
        'rendered_latitude' => 'float',
        'rendered_longitude' => 'float',
        'confirmed_at' => 'datetime',
        'rendered_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function record()
    {
        return $this->morphTo();
    }
}
