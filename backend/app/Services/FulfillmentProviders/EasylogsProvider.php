<?php

namespace App\Services\FulfillmentProviders;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Provider Router (Option B) — first REAL (non-mock) adapter, for Easylogs
 * Marketplace (https://www.easylogsmarketplace.com.ng/marketplace/api).
 * Adapted from a user-supplied integration script (originally a standalone
 * `EasylogsProvider` class + a parallel, hardcoded fulfilment pipeline that
 * bypassed ProviderRouter and duplicated columns already present on
 * `orders`) into this codebase's actual extension point: implements
 * FulfillmentProviderInterface so it plugs into the existing
 * FulfillmentAdapterResolver/ProviderRouter/ProviderHealthService machinery
 * exactly like MockFulfillmentProvider does, instead of a second pipeline.
 *
 * Endpoint shapes (`/ping`, `/balance`, `/order`, `/orders/{reference}`)
 * and auth (Bearer token via `providers.api_key`) come from that script,
 * which the user represented as a real, working integration against their
 * own Easylogs account — NOT independently verified against Easylogs'
 * public docs (none were found; the marketplace site only exposes a
 * user-facing login/signup UI, no published API reference). If any request
 * below 404s or the response shape doesn't match once a real
 * EASYLOGS_API_TOKEN is configured, treat that as this adapter needing a
 * fix, not the wiring around it.
 *
 * Registered in FulfillmentAdapterResolver::ADAPTERS['easylogs'] — so any
 * Service that gets an 'easylogs'-slugged Provider added to its
 * service_provider_routes chain (via the Option B routing editor) is
 * automatically routed through this adapter, with the exact same
 * failover/health-tracking/cooldown behaviour as every other provider.
 * `service_provider_routes.provider_service_id` is this service's Easylogs
 * `product_code` (set per-route in the routing editor — see that table's
 * doc comment: "the provider's own identifier for this service").
 */
class EasylogsProvider implements FulfillmentProviderInterface
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = 'https://www.easylogsmarketplace.com.ng/marketplace/api',
    ) {}

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->withToken($this->apiKey)
            ->timeout(30)
            ->retry(2, 500, throw: false);
    }

    /**
     * @throws FulfillmentException Retryable on network-level failure
     *                              (DNS/connect/timeout — request almost
     *                              certainly never reached Easylogs) or
     *                              HTTP 5xx; NonRetryable on HTTP 4xx
     *                              (bad request/auth/product code — will
     *                              fail identically on retry).
     */
    private function request(string $method, string $path, array $payload = [], array $query = []): array
    {
        $url = rtrim($this->baseUrl, '/').'/'.ltrim($path, '/');

        try {
            $response = $method === 'POST'
                ? $this->client()->post($url, $payload)
                : $this->client()->get($url, $query);
        } catch (ConnectionException $e) {
            throw new FulfillmentException(
                "Easylogs connection failed: {$e->getMessage()}",
                FulfillmentErrorType::Retryable,
                $e,
            );
        }

        if ($response->serverError()) {
            throw new FulfillmentException(
                "Easylogs returned HTTP {$response->status()} (server error).",
                FulfillmentErrorType::Retryable,
            );
        }

        $data = $response->json();

        if (! is_array($data)) {
            // A non-JSON body on an otherwise-2xx/4xx response is not a
            // connectivity problem (we did reach Easylogs and it did
            // respond) — treat as NonRetryable rather than blindly failing
            // over to a provider that would behave identically.
            throw new FulfillmentException(
                'Easylogs returned a non-JSON response.',
                FulfillmentErrorType::NonRetryable,
            );
        }

        if ($response->clientError()) {
            throw new FulfillmentException(
                (string) ($data['message'] ?? $data['error'] ?? "Easylogs rejected the request (HTTP {$response->status()})."),
                FulfillmentErrorType::NonRetryable,
            );
        }

        return $data;
    }

    /**
     * `request.provider_service_id` is this service's Easylogs
     * `product_code` (set on the service_provider_routes row — see the
     * routing editor). Missing/blank is a configuration error on OUR side,
     * not an upstream failure, but it will fail identically on every other
     * provider in the chain too (none of them can guess a product code),
     * so it's classified NonRetryable rather than left to throw a generic
     * exception ProviderRouter doesn't know how to handle.
     */
    public function fulfill(array $request): array
    {
        $productCode = $request['provider_service_id'] ?? null;

        if (blank($productCode)) {
            throw new FulfillmentException(
                'Easylogs product code (provider_service_id) is not configured for this route.',
                FulfillmentErrorType::NonRetryable,
            );
        }

        try {
            $result = $this->request('POST', '/order', [
                'product_code' => $productCode,
                'quantity' => $request['quantity'] ?? 1,
                'reference' => $request['reference'],
                'currency' => 'NGN',
            ]);
        } catch (FulfillmentException $e) {
            throw $e;
        } catch (Throwable $e) {
            // Anything unexpected while decoding/handling a response we DID
            // get back from Easylogs (not a connection failure) is
            // ambiguous: we can't be sure whether the order was placed on
            // their side or not, so ProviderRouter must check status
            // before ever considering a failover.
            throw new FulfillmentException(
                "Easylogs order request failed unexpectedly: {$e->getMessage()}",
                FulfillmentErrorType::Ambiguous,
                $e,
            );
        }

        $data = $result['data'] ?? $result;
        $externalReference = $data['reference'] ?? $request['reference'];
        $delivered = $data['items'] ?? null;

        return [
            'external_reference' => (string) $externalReference,
            'status' => ($result['status'] ?? null) === 'success' || $delivered
                ? 'completed'
                : 'pending',
            'raw' => $result,
        ];
    }

    /**
     * Polls GET /orders/{reference} for the outcome of a previous fulfill()
     * call. Used both for the normal async "pending -> completed" path
     * (if a caller polls directly) and, critically, by ProviderRouter's
     * ambiguous-failure resolution — checking a reference that may or may
     * not have actually been placed on Easylogs' side before ever failing
     * over to the next provider.
     */
    public function checkStatus(string $reference): array
    {
        try {
            $result = $this->request('GET', '/orders/'.rawurlencode($reference));
        } catch (FulfillmentException $e) {
            // A definitive NonRetryable rejection here (e.g. Easylogs
            // simply doesn't recognize the reference) reads as "never
            // placed" from ProviderRouter's point of view, not a hard
            // failure of the status check itself.
            if ($e->errorType === FulfillmentErrorType::NonRetryable) {
                return ['status' => 'not_found', 'raw' => ['error' => $e->getMessage()]];
            }

            throw $e;
        }

        $data = $result['data'] ?? $result;
        $providerStatus = strtolower((string) ($data['status'] ?? $result['status'] ?? ''));

        return [
            'status' => match ($providerStatus) {
                'success', 'completed', 'delivered' => 'completed',
                'failed', 'cancelled', 'canceled', 'rejected' => 'failed',
                'not_found' => 'not_found',
                default => 'pending',
            },
            'raw' => $result,
        ];
    }

    /**
     * "Test connection" / synthetic health check — GET /balance (cheapest
     * authenticated read that proves the token + base URL actually work)
     * without placing any order. Must never throw (interface contract):
     * every failure mode is translated to `ok: false` with a message.
     */
    public function ping(): array
    {
        try {
            $result = $this->request('GET', '/balance', query: ['currency' => 'NGN']);
        } catch (FulfillmentException $e) {
            return [
                'ok' => false,
                'message' => $e->getMessage(),
                'raw' => ['error_type' => $e->errorType->value],
            ];
        } catch (Throwable $e) {
            return [
                'ok' => false,
                'message' => "Easylogs ping failed unexpectedly: {$e->getMessage()}",
                'raw' => [],
            ];
        }

        return [
            'ok' => true,
            'message' => 'Easylogs reachable.',
            'raw' => $result,
        ];
    }
}
