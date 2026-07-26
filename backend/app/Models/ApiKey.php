<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApiKey extends Model
{
    protected $fillable = [
        'name',
        'key',
        'provider',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];
}
