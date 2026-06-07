<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialSpecification extends Model
{
    protected $fillable = [
        'material_type_id',
        'name',
        'status',
    ];

    public function materialType()
    {
        return $this->belongsTo(MaterialType::class);
    }
}
