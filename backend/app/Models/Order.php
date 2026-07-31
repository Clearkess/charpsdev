<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'user_id',
        'service_id',
        'reference',
        'order_number',
        'quantity',
        'amount',
        'total',
        'coupon_code',
        'discount',
        'payload',
        'provider_reference',
        'status',
        'payment_method',
        'details',
    ];

    protected $casts = [
        'payload' => 'array',
        'details' => 'array',
        'amount' => 'decimal:2',
        'total' => 'decimal:2',
        'discount' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
