<?php

namespace Tests\Feature\Providers;

use App\Models\CartItem;
use App\Models\Order;
use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Provider Router (Option A), step 5 — end-to-end coverage of
 * CheckoutController -> OrderFulfillmentService -> ProviderRouter, hitting
 * the real POST /api/checkout route with Sanctum auth, exactly as the
 * mobile/web frontend does. Confirms the critical behavioural change: a
 * Service WITH a configured provider-routing chain now actually gets
 * fulfilled (or rejected/refunded) automatically, while a Service with NO
 * routing configured keeps today's exact 'pending' behaviour untouched.
 */
class CheckoutFulfillmentTest extends TestCase
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
            'name' => 'MTN 1GB Data',
            'slug' => 'mtn-1gb-data-'.Str::random(6),
            'category' => 'vtu',
            'description' => 'Test service',
            'price' => $price,
            'currency' => 'NGN',
            'active' => true,
        ]);
    }

    private function makeProvider(string $mode): Provider
    {
        return Provider::create([
            'name' => 'vtpass',
            'slug' => 'vtpass-'.Str::random(6),
            'base_url' => '',
            'api_key' => 'mock:'.$mode,
            'active' => true,
            'category' => 'vtu',
            'health_status' => Provider::HEALTH_HEALTHY,
        ]);
    }

    public function test_checkout_for_routed_service_completes_and_debits_wallet_once(): void
    {
        $user = $this->makeUserWithWallet(10000);
        $service = $this->makeService(500);
        $provider = $this->makeProvider('success');
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        CartItem::create(['user_id' => $user->id, 'service_id' => $service->id, 'quantity' => 1]);

        $response = $this->actingAs($user)->postJson('/api/checkout', []);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'completed');
        $this->assertNotNull($response->json('data.provider_reference'));

        $order = Order::where('reference', $response->json('data.reference'))->first();
        $this->assertSame('completed', $order->status);
        $this->assertNotNull($order->delivered_at);

        $this->assertSame(9500.0, (float) $user->wallet->fresh()->balance);
        $this->assertSame(1, $provider->fresh()->success_count);
    }

    public function test_checkout_for_unrouted_service_keeps_legacy_pending_behaviour(): void
    {
        // No ServiceProviderRoute at all -> confirms Option A does not
        // change behaviour for a service nobody has configured routing
        // for yet (today's exact "stays pending for admin" flow).
        $user = $this->makeUserWithWallet(10000);
        $service = $this->makeService(500);

        CartItem::create(['user_id' => $user->id, 'service_id' => $service->id, 'quantity' => 1]);

        $response = $this->actingAs($user)->postJson('/api/checkout', []);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'pending');

        $this->assertSame(9500.0, (float) $user->wallet->fresh()->balance);
    }

    public function test_checkout_for_service_whose_provider_rejects_fails_order_and_refunds(): void
    {
        $user = $this->makeUserWithWallet(10000);
        $service = $this->makeService(500);
        $provider = $this->makeProvider('invalid_recipient');
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        CartItem::create(['user_id' => $user->id, 'service_id' => $service->id, 'quantity' => 1]);

        $response = $this->actingAs($user)->postJson('/api/checkout', []);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'failed');

        // Wallet was debited during checkout, then automatically refunded
        // by OrderFulfillmentService once the provider definitively
        // rejected the order -> net balance unchanged.
        $this->assertSame(10000.0, (float) $user->wallet->fresh()->balance);
    }

    public function test_checkout_fails_over_to_backup_provider_and_completes(): void
    {
        $user = $this->makeUserWithWallet(10000);
        $service = $this->makeService(500);
        $primary = $this->makeProvider('timeout');
        $backup = $this->makeProvider('success');
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $primary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        CartItem::create(['user_id' => $user->id, 'service_id' => $service->id, 'quantity' => 1]);

        $response = $this->actingAs($user)->postJson('/api/checkout', []);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'completed');

        $this->assertSame(1, $primary->fresh()->failure_count);
        $this->assertSame(1, $backup->fresh()->success_count);
    }

    public function test_checkout_with_all_providers_down_leaves_order_pending_for_manual_review(): void
    {
        $user = $this->makeUserWithWallet(10000);
        $service = $this->makeService(500);
        $provider = $this->makeProvider('connection_failure');
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        CartItem::create(['user_id' => $user->id, 'service_id' => $service->id, 'quantity' => 1]);

        $response = $this->actingAs($user)->postJson('/api/checkout', []);

        $response->assertStatus(201);
        // manual_review must NOT be auto-resolved to failed/completed —
        // stays pending, same as an unrouted service, for a human to
        // decide (and the wallet is NOT auto-refunded, since we don't yet
        // know for certain the order failed).
        $response->assertJsonPath('data.status', 'pending');
        $this->assertSame(9500.0, (float) $user->wallet->fresh()->balance);
    }
}
