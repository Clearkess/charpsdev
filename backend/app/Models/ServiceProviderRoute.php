<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row in a Service's provider failover chain (Provider Router, Option
 * A). `priority` (lower = tried first) is what ProviderRouter actually
 * orders by; `enabled` lets an admin park/disable a route without deleting
 * the row (and losing its failure_count/success_count history).
 *
 * `failure_count`/`success_count`/`last_success_at`/`last_failure_at` here
 * are scoped to THIS service+provider pairing, distinct from the same-named
 * columns on `providers` (which are the provider's lifetime totals across
 * every service it's routed for). Both are needed: the Admin UI's per-
 * service routing editor wants "how has VTpass done for MTN 1GB
 * specifically", while the provider health panel wants "how has VTpass
 * done overall".
 */
class ServiceProviderRoute extends Model
{
    protected $fillable = [
        'service_id',
        'provider_id',
        'priority',
        'enabled',
        'provider_service_id',
        'provider_cost',
        'failure_count',
        'success_count',
        'last_success_at',
        'last_failure_at',
    ];

    protected $casts = [
        'priority' => 'integer',
        'enabled' => 'boolean',
        'provider_cost' => 'decimal:4',
        'failure_count' => 'integer',
        'success_count' => 'integer',
        'last_success_at' => 'datetime',
        'last_failure_at' => 'datetime',
    ];

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }

    public function recordSuccess(): void
    {
        $this->increment('success_count');
        $this->forceFill(['last_success_at' => now()])->save();
    }

    public function recordFailure(): void
    {
        $this->increment('failure_count');
        $this->forceFill(['last_failure_at' => now()])->save();
    }
}
