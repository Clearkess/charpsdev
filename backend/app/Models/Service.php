<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{
    /**
     * Phase 6 (more notification triggers): stock level (inclusive) at or
     * below which admins get a one-time "low stock" alert as it's crossed
     * during checkout. A plain class constant rather than a Setting row —
     * unlike `support_email`/deposit bounds (Phase 4), this isn't something
     * an admin needs to tune per-store without a deploy, so a constant keeps
     * the feature simple; revisit as a Setting if that assumption changes.
     */
    public const LOW_STOCK_THRESHOLD = 5;

    protected $fillable = [
        'name',
        'slug',
        'category',
        'category_id',
        'description',
        'price',
        'currency',
        'stock',
        'active',
        'provider_id',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'active' => 'boolean',
        'stock' => 'integer',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Relation name is intentionally NOT "category" — that name collides
     * with the legacy `category` string column (Eloquent lets an
     * eager-loaded relation silently overwrite a same-named raw attribute
     * in toArray()/JSON output), which would non-deterministically turn
     * `category` into an object depending on what was eager-loaded. Use
     * `categoryGroup` for the relation and keep `category` as the
     * always-a-string legacy attribute.
     */
    public function categoryGroup(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }

    /**
     * Null stock means unlimited / instant-digital-delivery (no cap to
     * enforce). Anything else is treated as a hard inventory count.
     */
    public function hasStockFor(int $quantity): bool
    {
        return $this->stock === null || $this->stock >= $quantity;
    }
}
