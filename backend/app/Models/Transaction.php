<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    protected $fillable = [
        'user_id',
        'reference',
        'amount',
        'status',
        'type',
        'gateway',
        'description',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Purchase-type transactions share the same `reference` value as the
     * `orders` row created by CheckoutController (both are set to the same
     * generated "ORD-..." string). Deposit/admin-credit/admin-debit
     * transactions use distinctly different reference formats (a UUID,
     * "CRD-...", "DBT-..." respectively), so this relation naturally
     * resolves to null for those without needing a type check — but the
     * `type === 'purchase'` guard is kept where this is consumed for
     * clarity and defense against any future reference-format collision.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'reference', 'reference');
    }
}
