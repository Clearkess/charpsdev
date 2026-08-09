<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Provider extends Model
{
    /**
     * Provider Router (Option A): a provider is only ever eligible for
     * ProviderRouter selection when 'healthy'. 'degraded' means recent
     * failures but not yet pulled from rotation (still shown, still
     * selectable by direct-slug callers like VirtualNumberService);
     * 'offline' means ProviderHealthService has given up on it until it
     * recovers (via a passing health check or a fresh manual activation).
     */
    public const HEALTH_HEALTHY = 'healthy';

    public const HEALTH_DEGRADED = 'degraded';

    public const HEALTH_OFFLINE = 'offline';

    protected $fillable = [
        'name',
        'slug',
        'base_url',
        'api_key',
        'active',
        // Provider Router (Option A) fields:
        'category',
        'priority',
        'is_primary',
        'is_backup',
        'health_status',
        'failure_count',
        'success_count',
        'last_success_at',
        'last_failure_at',
        'last_health_check_at',
        'cooldown_until',
        'timeout_seconds',
    ];

    protected $casts = [
        'active' => 'boolean',
        'priority' => 'integer',
        'is_primary' => 'boolean',
        'is_backup' => 'boolean',
        'failure_count' => 'integer',
        'success_count' => 'integer',
        'last_success_at' => 'datetime',
        'last_failure_at' => 'datetime',
        'last_health_check_at' => 'datetime',
        'cooldown_until' => 'datetime',
        'timeout_seconds' => 'integer',
    ];

    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }

    public function virtualNumberOrders(): HasMany
    {
        return $this->hasMany(VirtualNumberOrder::class);
    }

    /**
     * Every service_provider_routes row this provider appears in, across
     * every service (not scoped to one service — use
     * Service::providerRoutes() for that side).
     */
    public function serviceRoutes(): HasMany
    {
        return $this->hasMany(ServiceProviderRoute::class);
    }

    public function healthChecks(): HasMany
    {
        return $this->hasMany(ProviderHealthCheck::class);
    }

    /**
     * True when this provider is currently sitting out a post-failure
     * cooldown window (see the providers migration's cooldown_until doc
     * comment) — ProviderRouter must skip it even if health_status is
     * still 'healthy'.
     */
    public function isInCooldown(): bool
    {
        return $this->cooldown_until !== null && $this->cooldown_until->isFuture();
    }

    /**
     * The single boolean ProviderRouter needs to decide "can this provider
     * be tried right now": active (admin hasn't disabled it), not flagged
     * 'offline' (ProviderHealthService's designation for "give up on this
     * one for now"), and not currently cooling down from a recent failure.
     *
     * Deliberately allows 'degraded' (not just 'healthy') once its
     * cooldown has expired: 'degraded' means "one recent failure, still
     * worth retrying", not "avoid" — excluding it here would let a single
     * transient blip permanently strand a provider at 'degraded' with no
     * path back to 'healthy' (recordSuccess() is the only thing that
     * clears it, and that can only run if the provider gets tried again).
     * Only 'offline' (a repeated/confirmed-bad incident) is excluded from
     * routing until it recovers.
     */
    public function isRoutable(): bool
    {
        return $this->active
            && $this->health_status !== self::HEALTH_OFFLINE
            && ! $this->isInCooldown();
    }
}
