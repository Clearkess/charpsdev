<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use App\Services\FulfillmentProviders\FulfillmentErrorType;
use App\Services\FulfillmentProviders\FulfillmentException;
use App\Services\FulfillmentProviders\FulfillmentProviderInterface;
use App\Services\FulfillmentProviders\MockFulfillmentProvider;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Provider Router (Option A) — picks a healthy provider for a Service from
 * its service_provider_routes chain (lowest priority number first), calls
 * it, and — governed strictly by the failure's FulfillmentErrorType — either
 * stops, checks status before deciding, or tries the next provider in the
 * chain. This is the "automatic failover" engine from the original
 * proposal; CheckoutController (or any future caller) never talks to a
 * FulfillmentProviderInterface adapter directly.
 *
 * Deliberately does NOT throw for any *expected* fulfilment outcome
 * (rejected / all-providers-exhausted / ambiguous-unresolved) — those are
 * normal business outcomes a caller must branch on, not exceptional
 * control flow. It only lets truly unexpected exceptions (e.g. a
 * misconfigured adapter class) bubble up.
 */
class ProviderRouter
{
    /**
     * Real per-slug adapters go here as they're built (mirrors
     * VirtualNumberService::ADAPTERS) — e.g. 'vtpass' =>
     * VtpassProvider::class. Empty today: no real fulfilment-provider
     * credentials exist anywhere in this codebase yet (confirmed via
     * .env.example — only Paystack keys). Every provider row falls back to
     * MockFulfillmentProvider below until a real adapter is registered
     * for its slug.
     */
    private const ADAPTERS = [];

    public function __construct(private readonly ProviderHealthService $health) {}

    /**
     * @return array{
     *     outcome: string,
     *     provider_id: ?int,
     *     provider_reference: ?string,
     *     attempts: array<int, array{provider_id: int, provider_slug: string, outcome: string, error_type: ?string, message: ?string}>,
     * }
     *
     * `outcome`:
     *   - 'completed' / 'pending': a provider accepted and fulfilled (or is
     *     asynchronously fulfilling) the request. provider_id/
     *     provider_reference identify who and how to check on it later.
     *   - 'rejected': a provider returned a NonRetryable error (bad
     *     recipient, insufficient provider balance, duplicate, ...) — this
     *     will fail identically on every other provider too. Caller should
     *     fail the order (and typically refund), not retry.
     *   - 'manual_review': every routable provider was tried and failed
     *     with Retryable errors (or an Ambiguous failure couldn't be
     *     resolved to a definite outcome via checkStatus) — a human needs
     *     to look at this order. Caller must NOT silently mark it failed
     *     (the ambiguous case may have actually fulfilled upstream) nor
     *     silently mark it completed.
     *   - 'no_routes': the service has no enabled, routable provider at
     *     all (e.g. brand new service, or every provider currently
     *     offline/in cooldown). Caller should treat like 'manual_review'.
     */
    public function route(Service $service, Order $order, array $requestContext = [], ?string $baseReference = null): array
    {
        $routes = $this->routableRoutes($service);

        if ($routes->isEmpty()) {
            Log::warning('ProviderRouter: no routable providers for service', ['service_id' => $service->id, 'order_id' => $order->id]);

            return ['outcome' => 'no_routes', 'provider_id' => null, 'provider_reference' => null, 'attempts' => []];
        }

        // Defaults to the order's own reference (single-item checkout: one
        // service, one attempt chain). A multi-item cart passes a distinct
        // $baseReference per line (e.g. "{$order->reference}-I{$item->id}")
        // so two services in the same order never generate colliding
        // per-attempt idempotency keys against the same provider.
        $baseReference ??= $order->reference;

        $attempts = [];

        foreach ($routes as $index => $route) {
            $provider = $route->provider;
            $attemptReference = $baseReference.'-R'.($index + 1);

            $request = array_merge($requestContext, [
                'reference' => $attemptReference,
                'provider_service_id' => $route->provider_service_id,
            ]);

            $startedAt = microtime(true);

            try {
                $result = $this->resolveAdapter($provider)->fulfill($request);
                $responseMs = (int) round((microtime(true) - $startedAt) * 1000);

                $route->recordSuccess();
                $this->health->recordSuccess($provider, $responseMs);

                $attempts[] = [
                    'provider_id' => $provider->id,
                    'provider_slug' => $provider->slug,
                    'outcome' => $result['status'],
                    'error_type' => null,
                    'message' => null,
                ];

                return [
                    'outcome' => $result['status'],
                    'provider_id' => $provider->id,
                    'provider_reference' => $result['external_reference'],
                    'attempts' => $attempts,
                ];
            } catch (FulfillmentException $e) {
                $responseMs = (int) round((microtime(true) - $startedAt) * 1000);

                if ($e->errorType === FulfillmentErrorType::Ambiguous) {
                    $resolved = $this->resolveAmbiguous($provider, $attemptReference, $e, $responseMs);

                    if ($resolved !== null) {
                        $route->recordSuccess();
                        $this->health->recordSuccess($provider, $responseMs);

                        $attempts[] = [
                            'provider_id' => $provider->id,
                            'provider_slug' => $provider->slug,
                            'outcome' => 'ambiguous_resolved_'.$resolved['status'],
                            'error_type' => FulfillmentErrorType::Ambiguous->value,
                            'message' => $e->getMessage(),
                        ];

                        return [
                            'outcome' => $resolved['status'],
                            'provider_id' => $provider->id,
                            'provider_reference' => $resolved['external_reference'],
                            'attempts' => $attempts,
                        ];
                    }

                    // Status check couldn't confirm EITHER way (still
                    // pending/unknown on the provider's own side). Per the
                    // proposal's rule, this must NOT trigger a failover to
                    // a different provider — that's exactly the
                    // double-fulfilment risk the rule exists to prevent.
                    // Stop here and surface for manual review.
                    $route->recordFailure();
                    $this->health->recordFailure($provider, 'ambiguous_unresolved', $e->getMessage(), null, $responseMs);

                    $attempts[] = [
                        'provider_id' => $provider->id,
                        'provider_slug' => $provider->slug,
                        'outcome' => 'ambiguous_unresolved',
                        'error_type' => FulfillmentErrorType::Ambiguous->value,
                        'message' => $e->getMessage(),
                    ];

                    return ['outcome' => 'manual_review', 'provider_id' => $provider->id, 'provider_reference' => null, 'attempts' => $attempts];
                }

                $route->recordFailure();
                $this->health->recordFailure($provider, $e->errorType->value, $e->getMessage(), null, $responseMs);

                $attempts[] = [
                    'provider_id' => $provider->id,
                    'provider_slug' => $provider->slug,
                    'outcome' => 'failed',
                    'error_type' => $e->errorType->value,
                    'message' => $e->getMessage(),
                ];

                if ($e->errorType === FulfillmentErrorType::NonRetryable) {
                    // Definitively rejected by the upstream on grounds that
                    // will be identical on every other provider (bad
                    // recipient, invalid service, duplicate transaction,
                    // ...) — stop the chain immediately rather than wasting
                    // calls on providers 2..N.
                    return ['outcome' => 'rejected', 'provider_id' => $provider->id, 'provider_reference' => null, 'attempts' => $attempts];
                }

                // Retryable: safe to try the next provider in the chain.
                continue;
            }
        }

        // Every routable provider was tried and every failure was
        // Retryable — none confirmed fulfilment, but none definitively
        // rejected either. A human should look at this, not the system
        // guessing either way.
        return ['outcome' => 'manual_review', 'provider_id' => null, 'provider_reference' => null, 'attempts' => $attempts];
    }

    /**
     * Queries the ORIGINAL provider's own transaction status before ever
     * considering a failover, per the proposal's core anti-double-
     * fulfilment rule. Returns the resolved fulfil-style result if the
     * provider confirms it actually completed the transaction; null if the
     * provider says failed/not_found (safe to treat as a normal failure)
     * or if the status itself is inconclusive (caller must not fail over).
     */
    private function resolveAmbiguous(Provider $provider, string $reference, FulfillmentException $original, int $responseMs): ?array
    {
        try {
            $status = $this->resolveAdapter($provider)->checkStatus($reference);
        } catch (\Throwable $e) {
            Log::warning('ProviderRouter: status check after ambiguous failure itself failed', [
                'provider_id' => $provider->id,
                'reference' => $reference,
                'message' => $e->getMessage(),
            ]);

            return null;
        }

        if ($status['status'] === 'completed') {
            return ['status' => 'completed', 'external_reference' => $reference, 'raw' => $status['raw'] ?? []];
        }

        if (in_array($status['status'], ['failed', 'not_found'], true)) {
            // Confirmed it never fulfilled — behaves like a normal
            // Retryable failure from here (recorded as a failure by the
            // caller; NOT resolved as a success).
            return null;
        }

        // 'pending' or anything else unrecognized: genuinely still
        // unknown. Caller treats this as manual_review, not a failover.
        return null;
    }

    /**
     * @return Collection<int, ServiceProviderRoute>
     */
    private function routableRoutes(Service $service)
    {
        return $service->providerRoutes()
            ->where('enabled', true)
            ->with('provider')
            ->orderBy('priority')
            ->get()
            ->filter(fn (ServiceProviderRoute $route) => $route->provider !== null && $route->provider->isRoutable())
            ->values();
    }

    private function resolveAdapter(Provider $provider): FulfillmentProviderInterface
    {
        $adapterClass = self::ADAPTERS[$provider->slug] ?? MockFulfillmentProvider::class;

        return blank($provider->base_url)
            ? new $adapterClass($provider->api_key)
            : new $adapterClass($provider->api_key, rtrim($provider->base_url, '/'));
    }
}
