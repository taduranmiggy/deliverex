<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatbotIntent extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'description',
        'answer',
        'owner',
        'keywords',
        'training_phrases',
        'is_active',
        'hit_count',
        'resolved_count',
    ];

    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'training_phrases' => 'array',
            'is_active' => 'boolean',
            'hit_count' => 'integer',
            'resolved_count' => 'integer',
        ];
    }

    public function interactions(): HasMany
    {
        return $this->hasMany(ChatbotInteraction::class, 'intent_id');
    }
}
