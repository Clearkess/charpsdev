<?php

namespace App\Services\FulfillmentProviders;

/**
 * Provider Router (Option A) — the generic contract every fulfilment
 * provider adapter (VTpass, Flutterwave, ..., and the built-in
 * MockFulfillmentProvider used until real credentials exist) must
 * implement. Mirrors the shape of the existing
 * App\Services\SmsProviders\SmsProviderInterface pattern, but scoped to
 * "fulfil one order line against one upstream service", not the
 * browse-countries/browse-services virtual-number flow.
 *
 * No adapter for a real upstream (VTpass/Flutterwave/...) exists in this
 * codebase yet — confirmed via .env.example having only Paystack keys.
 * MockFulfillmentProvider is the only concrete implementation until real
 * credentials are configured; it stands in so the ProviderRouter and the
 * checkout integration have something real to run against end-to-end.
 */
interface FulfillmentProviderInterface
{
    /**
     * Attempts to fulfil one order line against the upstream provider.
     *
     * @param  array{
     *     reference: string,
     *     provider_service_id: ?string,
     *     quantity: int,
     *     amount: float,
     *     recipient: ?string,
     * }  $request  `reference` is the caller's own idempotency key (the
     *     order's `reference`, or `reference` + a `-Rn` suffix per retry
     *     attempt — see ProviderRouter) — adapters for real providers that
     *     support idempotency keys/dedupe-on-their-side should pass it
     *     through; MockFulfillmentProvider just echoes it back.
     * @return array{external_reference: string, status: string, raw: array}
     *                                                                       `status` is one of: 'completed' (fulfilled immediately),
     *                                                                       'pending' (accepted, async — caller should checkStatus() later).
     *
     * @throws FulfillmentException on any failure. The exception's
     *                              `errorType` tells the caller whether it's safe to fail over to
     *                              the next provider (Retryable), must NOT fail over
     *                              (NonRetryable), or must check status on THIS provider before
     *                              deciding (Ambiguous).
     */
    public function fulfill(array $request): array;

    /**
     * Polls the upstream provider for the current state of a previously
     * attempted fulfilment, keyed by the `external_reference` a prior
     * fulfill() call returned (or, for an Ambiguous failure where no
     * external_reference was ever returned, the original `reference` we
     * sent — adapters must accept either).
     *
     * @return array{status: string, raw: array} `status` is one of:
     *                                           'completed', 'pending', 'failed', 'not_found'.
     */
    public function checkStatus(string $reference): array;

    /**
     * Provider Router (Option B) — a lightweight connectivity/credential
     * check with no side effects on the upstream (no order is placed, no
     * balance is spent), used by the Admin API's "Test connection" button
     * and by ProviderHealthService's synthetic health-check endpoint.
     * Adapters for real providers should hit whatever the cheapest
     * authenticated read is (e.g. a balance/wallet-lookup endpoint);
     * MockFulfillmentProvider derives a synthetic result from the same
     * api_key-driven mode used by fulfill().
     *
     * Must NOT throw — connectivity failures are reported via `ok: false`,
     * not exceptions, since callers (Admin API, health checks) always need
     * a normal response to show the admin, not a 500.
     *
     * @return array{ok: bool, message: string, raw: array}
     */
    public function ping(): array;
}
