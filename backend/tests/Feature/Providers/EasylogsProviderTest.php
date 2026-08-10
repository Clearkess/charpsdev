<?php

namespace Tests\Feature\Providers;

use App\Services\FulfillmentProviders\EasylogsProvider;
use App\Services\FulfillmentProviders\FulfillmentErrorType;
use App\Services\FulfillmentProviders\FulfillmentException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Provider Router (Option B) — EasylogsProvider is the first real (non-mock)
 * FulfillmentProviderInterface adapter. These tests fake the HTTP layer
 * (Http::fake) rather than hitting the real Easylogs API — no real
 * EASYLOGS_API_TOKEN exists in this environment (or CI), so this validates
 * the adapter's request/response handling and FulfillmentErrorType
 * classification logic, not Easylogs' actual API behaviour. Re-verify
 * against the real API once a token is configured (see EasylogsProvider's
 * class doc comment).
 */
class EasylogsProviderTest extends TestCase
{
    private function makeProvider(): EasylogsProvider
    {
        return new EasylogsProvider('test-token', 'https://easylogs.test/api');
    }

    public function test_fulfill_completes_immediately_on_success_status(): void
    {
        Http::fake([
            'easylogs.test/api/order' => Http::response([
                'status' => 'success',
                'data' => ['reference' => 'EL-REF-123', 'items' => ['user@example.com:pass123']],
            ], 200),
        ]);

        $result = $this->makeProvider()->fulfill([
            'reference' => 'ORD-ABC-R1',
            'provider_service_id' => 'PROD-1',
            'quantity' => 1,
            'amount' => 500,
            'recipient' => null,
        ]);

        $this->assertSame('EL-REF-123', $result['external_reference']);
        $this->assertSame('completed', $result['status']);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://easylogs.test/api/order'
                && $request['product_code'] === 'PROD-1'
                && $request['reference'] === 'ORD-ABC-R1'
                && $request->hasHeader('Authorization', 'Bearer test-token');
        });
    }

    public function test_fulfill_reports_pending_when_status_is_not_success(): void
    {
        Http::fake([
            'easylogs.test/api/order' => Http::response([
                'status' => 'processing',
                'data' => ['reference' => 'EL-REF-456'],
            ], 200),
        ]);

        $result = $this->makeProvider()->fulfill([
            'reference' => 'ORD-ABC-R1',
            'provider_service_id' => 'PROD-1',
            'quantity' => 1,
        ]);

        $this->assertSame('EL-REF-456', $result['external_reference']);
        $this->assertSame('pending', $result['status']);
    }

    public function test_fulfill_throws_non_retryable_without_a_product_code(): void
    {
        Http::fake();

        try {
            $this->makeProvider()->fulfill([
                'reference' => 'ORD-ABC-R1',
                'provider_service_id' => null,
                'quantity' => 1,
            ]);
            $this->fail('Expected FulfillmentException.');
        } catch (FulfillmentException $e) {
            $this->assertSame(FulfillmentErrorType::NonRetryable, $e->errorType);
        }

        Http::assertNothingSent();
    }

    public function test_fulfill_throws_non_retryable_on_http_4xx(): void
    {
        Http::fake([
            'easylogs.test/api/order' => Http::response(['message' => 'Insufficient balance'], 402),
        ]);

        try {
            $this->makeProvider()->fulfill([
                'reference' => 'ORD-ABC-R1',
                'provider_service_id' => 'PROD-1',
                'quantity' => 1,
            ]);
            $this->fail('Expected FulfillmentException.');
        } catch (FulfillmentException $e) {
            $this->assertSame(FulfillmentErrorType::NonRetryable, $e->errorType);
            $this->assertSame('Insufficient balance', $e->getMessage());
        }
    }

    public function test_fulfill_throws_retryable_on_http_5xx(): void
    {
        Http::fake([
            'easylogs.test/api/order' => Http::response('Service Unavailable', 503),
        ]);

        try {
            $this->makeProvider()->fulfill([
                'reference' => 'ORD-ABC-R1',
                'provider_service_id' => 'PROD-1',
                'quantity' => 1,
            ]);
            $this->fail('Expected FulfillmentException.');
        } catch (FulfillmentException $e) {
            $this->assertSame(FulfillmentErrorType::Retryable, $e->errorType);
        }
    }

    public function test_fulfill_throws_retryable_on_connection_failure(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Could not resolve host');
        });

        try {
            $this->makeProvider()->fulfill([
                'reference' => 'ORD-ABC-R1',
                'provider_service_id' => 'PROD-1',
                'quantity' => 1,
            ]);
            $this->fail('Expected FulfillmentException.');
        } catch (FulfillmentException $e) {
            $this->assertSame(FulfillmentErrorType::Retryable, $e->errorType);
        }
    }

    public function test_check_status_maps_provider_statuses(): void
    {
        Http::fake([
            'easylogs.test/api/orders/EL-REF-123' => Http::response([
                'data' => ['status' => 'delivered'],
            ], 200),
        ]);

        $result = $this->makeProvider()->checkStatus('EL-REF-123');

        $this->assertSame('completed', $result['status']);
    }

    public function test_check_status_returns_not_found_when_easylogs_rejects_the_reference(): void
    {
        Http::fake([
            'easylogs.test/api/orders/*' => Http::response(['message' => 'Order not found'], 404),
        ]);

        $result = $this->makeProvider()->checkStatus('DOES-NOT-EXIST');

        $this->assertSame('not_found', $result['status']);
    }

    public function test_ping_reports_ok_on_reachable_balance_endpoint(): void
    {
        Http::fake([
            'easylogs.test/api/balance*' => Http::response(['data' => ['balance' => 1000]], 200),
        ]);

        $result = $this->makeProvider()->ping();

        $this->assertTrue($result['ok']);
    }

    public function test_ping_never_throws_and_reports_not_ok_on_connection_failure(): void
    {
        Http::fake(function () {
            throw new ConnectionException('timed out');
        });

        $result = $this->makeProvider()->ping();

        $this->assertFalse($result['ok']);
        $this->assertNotEmpty($result['message']);
    }
}
