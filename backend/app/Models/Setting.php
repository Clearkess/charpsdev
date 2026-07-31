<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'label',
    ];

    private const CACHE_KEY = 'settings:all';

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::CACHE_KEY));
    }

    /**
     * `value` is always stored as text; decode it back to its real type
     * using the row's own `type` hint so callers (e.g. DepositRequest)
     * get an int/float/bool, not a string, without needing to know the
     * storage format.
     */
    private static function cast(string $rawValue, string $type): mixed
    {
        return match ($type) {
            'integer' => (int) $rawValue,
            'float' => (float) $rawValue,
            'boolean' => in_array($rawValue, ['1', 'true'], true),
            'json' => json_decode($rawValue, true),
            default => $rawValue,
        };
    }

    /**
     * Read a setting by key, cast to its stored type, or $default if unset.
     * Cached for the request/process lifetime (cleared automatically on
     * any Setting save/delete) since settings are read on hot paths like
     * every deposit request but change rarely.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        // Cache a plain array (["key" => ["value" => ..., "type" => ...]]),
        // never the raw Eloquent Collection: unserializing a Collection of
        // models from the database cache driver on a second read within
        // the same request threw "tried to call a method on an incomplete
        // object" (a genuine bug found while testing this locally) — plain
        // arrays/scalars have no such serialization edge case.
        $all = Cache::rememberForever(self::CACHE_KEY, function () {
            return static::query()->get(['key', 'value', 'type'])
                ->mapWithKeys(fn (Setting $row) => [$row->key => ['value' => $row->value, 'type' => $row->type]])
                ->all();
        });

        $row = $all[$key] ?? null;
        if (! $row || $row['value'] === null) {
            return $default;
        }

        return self::cast($row['value'], $row['type']);
    }

    public static function set(string $key, mixed $value, string $type = 'string', string $group = 'general', ?string $label = null): Setting
    {
        $stored = $type === 'json' ? json_encode($value) : (string) $value;

        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $stored, 'type' => $type, 'group' => $group, 'label' => $label],
        );
    }
}
