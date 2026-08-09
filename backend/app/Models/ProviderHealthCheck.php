<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only history row: either an active ProviderHealthService ping, or
 * a passive observation of a real ProviderRouter fulfilment attempt
 * (success or failure) against a provider. See the creating migration for
 * why this is never updated in place and has no unique constraints.
 */
class ProviderHealthCheck extends Model
{
    protected $fillable = [
        'provider_id',
        'status',
        'response_time_ms',
        'http_status',
        'error_code',
        'error_message',
        'checked_at',
    ];

    protected $casts = [
        'response_time_ms' => 'integer',
        'http_status' => 'integer',
        'checked_at' => 'datetime',
    ];

    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }
}
