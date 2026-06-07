<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialType extends Model
{
    protected $fillable = [
        'name',
        'status',
    ];

    public function specifications()
    {
        return $this->hasMany(MaterialSpecification::class);
    }
}
