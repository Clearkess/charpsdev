<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Provider extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'base_url',
        'api_key',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];
}
