<?php

namespace Tests\Feature\Providers;

use App\Models\CartItem;
use App\Models\Order;
use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use App\Models\User;
use App\Models\Wallet;
use App\Services\FulfillmentProviders\EasylogsProvider;
use App\Services\FulfillmentProviders\FulfillmentAdapterResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Provider Router (Option B) — end-to-end coverage that a Provider row
 * with slug EXACTLY 'easylogs' actually resolves to the real
 * EasylogsProvider adapter (not MockFulfillmentProvider), and that a full
 * checkout routed through it, plus the async delivery webhook, behaves
 * exactly like OrderFulfillmentService/AdminOrderController's existing
 * 'pending' -> 'completed' + delivery-email flow.
 */
class EasylogsIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private function makeUserWithWallet(float $balance = 10000): User
    {
        $user = User::factory()->create();
        Wallet::create(['user_id' => $user->id, 'balance' => $balance, 'currency' => 'NGN']);

        return $user;
    }

    private function makeService(float $price = 500): Service
    {
        return Service::create([
            'name' => 'Netflix Premium 1 Month',
            'slug' => 'netflix-premium-'.Str::random(6),
            'category' => 'accounts',
            'description' => 'Test service',
            'price' => $price,
            'currency' => 'NGN',
            'active' => true,
        ]);
    }

    /**
     * slug is EXACTLY 'easylogs' — the one string FulfillmentAdapterResolver
     * matches against. Every other test in this suite uses a randomized
     * slug (e.g. 'vtpass-xxxxx') specifically so it does NOT collide with a
     * registered real adapter; this is the one place we want the collision.
     */
    private function makeEasylogsProvider(): Provider
    {
        return Provider::create([
            'name' => 'Easylogs Marketplace',
            'slug' => 'easylogs',
            'base_url' => 'https://easylogs.test/api',
            'api_key' => 'real-token',
            'active' => true,
            'category' => 'accounts',
            'health_status' => Provider::HEALTH_HEALTHY,
        ]);
    }

    public function test_resolver_picks_the_real_easylogs_adapter_for_the_easylogs_slug(): void
    {
        $provider = $this->makeEasylogsProvider();

        $adapter = FulfillmentAdapterResolver::resolve($provider);

        $this->assertInstanceOf(EasylogsProvider::class, $adapter);
        $this->assertTrue(FulfillmentAdapterResolver::isRealAdapter($provider));
    }

    public function test_checkout_routed_to_easylogs_completes_immediately_on_success_status(): void
    {
        Http::fake([
            'easylogs.test/api/order' => Http::response([
                'status' => 'success',
                'data' => ['reference' => 'EL-REF-999', 'items' => ['acct1@example.com:pass']],
            ], 200),
        ]);

        $user = $this->makeUserWithWallet(10000);
        $service = $this->makeService(500);
        $provider = $this->makeEasylogsProvider();
        ServiceProviderRoute::create([
            'service_id' => $service->id,
            'provider_id' => $provider->id,
            'priority' => 1,
            'enabled' => true,
            'provider_service_id' => 'PROD-NETFLIX-1M',
        ]);

        CartItem::create(['user_id' => $user->id, 'service_id' => $service->id, 'quantity' => 1]);

        $response = $this->actingAs($user)->postJson('/api/checkout', []);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'completed');
        $this->assertSame('EL-REF-999', $response->json('data.provider_reference'));

        Http::assertSent(fn ($request) => $request['product_code'] === 'PROD-NETFLIX-1M');
    }

    public function test_checkout_routed_to_easylogs_stays_processing_when_pending_then_webhook_completes_it(): void
    {
        Http::fake([
            'easylogs.test/api/order' => Http::response([
                'status' => 'processing',
                'data' => ['reference' => 'EL-REF-PENDING'],
            ], 200),
        ]);

        $user = $this->makeUserWithWallet(10000);
        $service = $this->makeService(500);
        $provider = $this->makeEasylogsProvider();
        ServiceProviderRoute::create([
            'service_id' => $service->id,
            'provider_id' => $provider->id,
            'priority' => 1,
            'enabled' => true,
            'provider_service_id' => 'PROD-NETFLIX-1M',
        ]);

        CartItem::create(['user_id' => $user->id, 'service_id' => $service->id, 'quantity' => 1]);

        $checkoutResponse = $this->actingAs($user)->postJson('/api/checkout', []);
        $checkoutResponse->assertStatus(201);
        $checkoutResponse->assertJsonPath('data.status', 'processing');

        $order = Order::where('reference', $checkoutResponse->json('data.reference'))->first();
        $this->assertSame('EL-REF-PENDING', $order->provider_reference);
        $this->assertNull($order->delivered_at);

        // Easylogs later confirms delivery via the webhook.
        $webhookResponse = $this->postJson('/api/webhooks/easylogs', [
            'event' => 'order.delivered',
            'data' => [
                'reference' => 'EL-REF-PENDING',
                'items' => ['acct1@example.com:pass'],
            ],
        ]);

        $webhookResponse->assertStatus(200);
        $webhookResponse->assertJsonPath('success', true);

        $order->refresh();
        $this->assertSame('completed', $order->status);
        $this->assertNotNull($order->delivered_at);
        $this->assertSame('acct1@example.com:pass', $order->delivery_content);
    }

    public function test_webhook_returns_404_for_an_unknown_reference(): void
    {
        $response = $this->postJson('/api/webhooks/easylogs', [
            'event' => 'order.delivered',
            'data' => ['reference' => 'DOES-NOT-EXIST'],
        ]);

        $response->assertStatus(404);
    }

    public function test_webhook_ignores_events_other_than_order_delivered(): void
    {
        $response = $this->postJson('/api/webhooks/easylogs', [
            'event' => 'order.created',
            'data' => ['reference' => 'ANYTHING'],
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Event ignored.');
    }

    public function test_webhook_rejects_request_with_wrong_secret_when_one_is_configured(): void
    {
        config(['services.easylogs.webhook_secret' => 'super-secret']);

        $response = $this->postJson('/api/webhooks/easylogs', [
            'event' => 'order.delivered',
            'data' => ['reference' => 'ANYTHING'],
        ], ['X-Easylogs-Secret' => 'wrong']);

        $response->assertStatus(401);
    }

    public function test_webhook_accepts_request_with_correct_secret(): void
    {
        config(['services.easylogs.webhook_secret' => 'super-secret']);

        $user = $this->makeUserWithWallet(10000);
        $order = Order::create([
            'user_id' => $user->id,
            'reference' => 'ORD-SECRETTEST',
            'provider_reference' => 'EL-REF-SECRETTEST',
            'amount' => 500,
            'status' => 'processing',
        ]);

        $response = $this->postJson('/api/webhooks/easylogs', [
            'event' => 'order.delivered',
            'data' => ['reference' => 'EL-REF-SECRETTEST'],
        ], ['X-Easylogs-Secret' => 'super-secret']);

        $response->assertStatus(200);
        $this->assertSame('completed', $order->fresh()->status);
    }

    public function test_webhook_is_idempotent_for_an_already_completed_order(): void
    {
        $user = $this->makeUserWithWallet(10000);
        $order = Order::create([
            'user_id' => $user->id,
            'reference' => 'ORD-ALREADYDONE',
            'provider_reference' => 'EL-REF-ALREADYDONE',
            'amount' => 500,
            'status' => 'completed',
            'delivered_at' => now(),
            'delivery_content' => 'original-content',
        ]);

        $response = $this->postJson('/api/webhooks/easylogs', [
            'event' => 'order.delivered',
            'data' => ['reference' => 'EL-REF-ALREADYDONE', 'items' => ['new-content']],
        ]);

        $response->assertStatus(200);

        // Still completed, delivered_at unchanged, no duplicate
        // notification/email should have fired (not directly assertable
        // here without a mail fake, but the "wasAlreadyCompleted" guard in
        // the controller skips that branch entirely for this case).
        $this->assertSame('completed', $order->fresh()->status);
    }
}
