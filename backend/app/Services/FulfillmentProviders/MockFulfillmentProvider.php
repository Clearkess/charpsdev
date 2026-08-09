<?php

namespace App\Services\FulfillmentProviders;

use Illuminate\Support\Str;

/**
 * Provider Router (Option A) — stand-in adapter used until a real upstream
 * (VTpass, Flutterwave, ...) is configured. No real VTU/fulfilment provider
 * credentials exist anywhere in this codebase yet (confirmed via
 * .env.example: only Paystack keys) — this is what lets ProviderRouter and
 * the checkout integration be built and tested end-to-end today, and swapped
 * for a real adapter later without changing anything else (ProviderRouter
 * only ever depends on FulfillmentProviderInterface).
 *
 * The behaviour to simulate is read from the owning `providers.api_key`
 * value, exactly like a real adapter reads its real API key from that same
 * column — a mock "credential" that happens to double as a test-behaviour
 * switch, so seeding a specific failure mode is just `Provider::create([...,
 * 'api_key' => 'mock:timeout'])`, no special test-only hooks needed.
 *
 * Supported `api_key` values:
 *   mock:success            (default/fallback) - always fulfils immediately.
 *   mock:timeout             - throws Retryable (simulates a connect/read timeout).
 *   mock:connection_failure  - throws Retryable.
 *   mock:http_503            - throws Retryable.
 *   mock:insufficient_balance - throws NonRetryable.
 *   mock:invalid_recipient    - throws NonRetryable.
 *   mock:already_exists       - throws NonRetryable.
 *   mock:ambiguous_timeout    - throws Ambiguous on fulfill(), but
 *                               checkStatus() reports 'completed' — used to
 *                               test the "query original provider before
 *                               failing over" rule.
 */
class MockFulfillmentProvider implements FulfillmentProviderInterface
{
    public function __construct(
        private readonly string $apiKey,
        private readonly ?string $baseUrl = null,
    ) {}

    private function mode(): string
    {
        return Str::startsWith($this->apiKey, 'mock:')
            ? Str::after($this->apiKey, 'mock:')
            : 'success';
    }

    public function fulfill(array $request): array
    {
        $mode = $this->mode();

        return match ($mode) {
            'success' => [
                'external_reference' => 'MOCK-'.Str::upper(Str::random(10)),
                'status' => 'completed',
                'raw' => ['mode' => $mode, 'request' => $request],
            ],
            'timeout', 'connection_failure' => throw new FulfillmentException(
                "Mock provider simulated a {$mode}.",
                FulfillmentErrorType::Retryable,
            ),
            'http_503' => throw new FulfillmentException(
                'Mock provider simulated HTTP 503 Service Unavailable.',
                FulfillmentErrorType::Retryable,
            ),
            'insufficient_balance' => throw new FulfillmentException(
                'Mock provider simulated insufficient provider balance.',
                FulfillmentErrorType::NonRetryable,
            ),
            'invalid_recipient' => throw new FulfillmentException(
                'Mock provider simulated an invalid recipient/customer number.',
                FulfillmentErrorType::NonRetryable,
            ),
            'already_exists' => throw new FulfillmentException(
                'Mock provider simulated a duplicate/already-exists transaction.',
                FulfillmentErrorType::NonRetryable,
            ),
            'ambiguous_timeout' => throw new FulfillmentException(
                'Mock provider simulated an ambiguous timeout (unknown outcome).',
                FulfillmentErrorType::Ambiguous,
            ),
            default => [
                'external_reference' => 'MOCK-'.Str::upper(Str::random(10)),
                'status' => 'completed',
                'raw' => ['mode' => $mode, 'request' => $request, 'note' => 'unrecognized mode, defaulted to success'],
            ],
        };
    }

    public function checkStatus(string $reference): array
    {
        // Only meaningfully exercised by the 'ambiguous_timeout' mode in
        // tests: the fulfill() call above threw Ambiguous, but the upstream
        // actually DID complete the transaction, which is exactly the
        // double-fulfilment trap ProviderRouter's status-check-first rule
        // exists to catch.
        if ($this->mode() === 'ambiguous_timeout') {
            return ['status' => 'completed', 'raw' => ['reference' => $reference, 'mode' => 'ambiguous_timeout']];
        }

        return ['status' => 'completed', 'raw' => ['reference' => $reference]];
    }

    public function ping(): array
    {
        $mode = $this->mode();

        // A "connectivity" check is only meaningfully unhealthy for the
        // modes that represent a down/unreachable upstream. The
        // NonRetryable business-error modes (insufficient_balance, etc.)
        // are about a *specific transaction*, not connectivity — a mock
        // "Test connection" click reports those as reachable.
        $unreachable = in_array($mode, ['timeout', 'connection_failure', 'http_503'], true);

        return [
            'ok' => ! $unreachable,
            'message' => $unreachable
                ? "Mock provider simulated a {$mode} while pinging."
                : 'Mock provider reachable (mode: '.$mode.').',
            'raw' => ['mode' => $mode],
        ];
    }
}
