<?php

namespace App\Services\FulfillmentProviders;

use App\Models\Provider;

/**
 * Provider Router (Option B) — the single place that maps a Provider row to
 * a concrete FulfillmentProviderInterface instance. Extracted out of
 * ProviderRouter's former private resolveAdapter() so the new Admin API
 * (ProviderController::test()/healthCheck()) can resolve the exact same
 * adapter an actual checkout would use, instead of duplicating the
 * slug->class lookup or (worse) hard-coding MockFulfillmentProvider.
 *
 * Real per-slug adapters (VTpass, Flutterwave, ...) get registered here as
 * they're built — e.g. 'vtpass' => VtpassProvider::class. Empty today: no
 * real fulfilment-provider credentials exist anywhere in this codebase yet
 * (confirmed via .env.example — only Paystack keys). Every provider row
 * falls back to MockFulfillmentProvider until a real adapter is registered
 * for its slug.
 */
class FulfillmentAdapterResolver
{
    private const ADAPTERS = [];

    public static function resolve(Provider $provider): FulfillmentProviderInterface
    {
        $adapterClass = self::ADAPTERS[$provider->slug] ?? MockFulfillmentProvider::class;

        return blank($provider->base_url)
            ? new $adapterClass($provider->api_key)
            : new $adapterClass($provider->api_key, rtrim($provider->base_url, '/'));
    }

    /**
     * True when a real (non-mock) adapter is registered for this provider's
     * slug. Surfaced to the Admin UI so it can warn "this is still running
     * against the mock adapter" instead of silently pretending a Test
     * click proves a real upstream integration works.
     */
    public static function isRealAdapter(Provider $provider): bool
    {
        return array_key_exists($provider->slug, self::ADAPTERS);
    }
}
