<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VirtualNumberOrder extends Model
{
    protected $fillable = [
        'user_id',
        'provider_id',
        'provider_slug',
        'external_id',
        'phone_number',
        'country',
        'service_code',
        'service_name',
        'operator',
        'cost_usd',
        'exchange_rate',
        'markup_percent',
        'price_ngn',
        'currency',
        'status',
        'sms_code',
        'sms_text',
        'reference',
        'expires_at',
        'completed_at',
        'cancelled_at',
        'meta',
    ];

    protected $casts = [
        'cost_usd' => 'decimal:4',
        'exchange_rate' => 'decimal:4',
        'markup_percent' => 'decimal:2',
        'price_ngn' => 'decimal:2',
        'expires_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'meta' => 'array',
    ];

    /**
     * Statuses that are still "in flight" and worth actively polling the
     * provider for (as opposed to a terminal state like received/cancelled/
     * expired/refunded/failed, which never needs another provider call).
     */
    public const ACTIVE_STATUSES = ['pending', 'waiting_code'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }
}
