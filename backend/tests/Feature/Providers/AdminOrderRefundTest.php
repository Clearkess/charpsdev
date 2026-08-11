<?php

namespace Tests\Feature\Providers;

use App\Models\Order;
use App\Models\Service;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Regression coverage for a real production incident (order #18,
 * ORD-QZ4ITOZ7YE): AdminOrderController::update() had NO refund logic at
 * all — only OrderFulfillmentService::fulfill()'s own automatic
 * ProviderRouter-driven 'failed' outcome ever credited the wallet back
 * (see OrderFulfillmentService::refund()). An admin manually closing out a
 * stuck order (e.g. one left 'pending' after every provider was
 * unroutable) by setting its status to 'failed'/'cancelled' from the Admin
 * Orders screen silently kept the customer's money debited, with no
 * refund transaction and no record of one.
 *
 * This exercises the fix: OrderFulfillmentService::refundIfNotAlready(),
 * called from AdminOrderController::update() whenever an admin transitions
 * an order INTO 'failed'/'cancelled' from some other status.
 */
class AdminOrderRefundTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function makeService(float $price = 540): Service
    {
        return Service::create([
            'name' => 'TikTok New Zealand accounts',
            'slug' => 'tiktok-nz-'.Str::random(6),
            'category' => 'accounts',
            'description' => 'Test service',
            'price' => $price,
            'currency' => 'NGN',
            'active' => true,
        ]);
    }

    /**
     * Mirrors CheckoutController::store()'s debit shape exactly — the
     * `wallet_transactions` row with `reference` = the order's own
     * reference and `type` = 'debit' is what
     * OrderFulfillmentService::wasWalletDebited() looks for.
     */
    private function makeWalletDebitedOrder(User $user, Service $service, string $status = 'pending'): Order
    {
        $wallet = Wallet::create(['user_id' => $user->id, 'balance' => 1000, 'currency' => 'NGN']);
        $reference = 'ORD-'.Str::upper(Str::random(10));

        $order = Order::create([
            'user_id' => $user->id,
            'service_id' => $service->id,
            'reference' => $reference,
            'order_number' => $reference,
            'quantity' => 1,
            'amount' => $service->price,
            'total' => $service->price,
            'status' => $status,
            'payment_method' => 'wallet',
            'details' => [
                'items' => [['service_name' => $service->name, 'unit_price' => (float) $service->price, 'quantity' => 1]],
                'subtotal' => (float) $service->price,
            ],
        ]);

        $wallet->decrement('balance', $service->price);
        $wallet->transactions()->create([
            'wallet_id' => $wallet->id,
            'user_id' => $user->id,
            'type' => 'debit',
            'amount' => $service->price,
            'reference' => $reference,
            'description' => "Purchase: order {$reference} (1 item)",
            'status' => 'success',
        ]);

        return $order;
    }

    /**
     * Mirrors the legacy OrderController::store() flow, which creates an
     * Order WITHOUT ever debiting a wallet (confirmed by reading that
     * controller in full, and against real production data: order #10
     * has no matching wallet_transactions row at all).
     */
    private function makeUnbilledLegacyOrder(User $user, Service $service, string $status = 'pending'): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'service_id' => $service->id,
            'reference' => 'ORD-'.Str::upper(Str::random(10)),
            'quantity' => 1,
            'amount' => $service->price,
            'status' => $status,
            'details' => [
                'service_name' => $service->name,
                'unit_price' => (float) $service->price,
                'quantity' => 1,
            ],
        ]);
    }

    public function test_marking_a_pending_order_failed_refunds_the_wallet(): void
    {
        $user = User::factory()->create();
        $service = $this->makeService();
        $order = $this->makeWalletDebitedOrder($user, $service, 'pending');

        $response = $this->actingAs($this->admin())->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'failed',
        ]);

        $response->assertOk();

        $wallet = Wallet::where('user_id', $user->id)->first();
        $this->assertSame('1000.00', $wallet->balance); // debited 540 at setup, refunded 540 here -> back to 1000

        $this->assertDatabaseHas('wallet_transactions', [
            'reference' => $order->reference.'-REFUND',
            'type' => 'credit',
            'amount' => '540.00',
        ]);

        $this->assertDatabaseHas('transactions', [
            'reference' => $order->reference.'-REFUND',
            'type' => 'refund',
        ]);
    }

    public function test_marking_a_pending_order_cancelled_also_refunds_the_wallet(): void
    {
        $user = User::factory()->create();
        $service = $this->makeService();
        $order = $this->makeWalletDebitedOrder($user, $service, 'pending');

        $this->actingAs($this->admin())->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'cancelled',
        ])->assertOk();

        $wallet = Wallet::where('user_id', $user->id)->first();
        $this->assertSame('1000.00', $wallet->balance);
        $this->assertDatabaseHas('wallet_transactions', ['reference' => $order->reference.'-REFUND']);
    }

    public function test_refund_is_not_duplicated_if_order_was_already_refunded(): void
    {
        $user = User::factory()->create();
        $service = $this->makeService();
        $order = $this->makeWalletDebitedOrder($user, $service, 'pending');

        $this->actingAs($this->admin())->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'failed',
        ])->assertOk();

        $this->assertSame(1, WalletTransaction::where('reference', $order->reference.'-REFUND')->count());

        // Admin edits the same already-failed order again (e.g. just to
        // attach a note) -- previousStatus === 'failed' already, so this
        // must NOT be treated as a fresh "closed as unfulfilled"
        // transition, and must NOT refund a second time.
        $this->actingAs($this->admin())->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'failed',
        ])->assertOk();

        $this->assertSame(1, WalletTransaction::where('reference', $order->reference.'-REFUND')->count());

        $wallet = Wallet::where('user_id', $user->id)->first();
        $this->assertSame('1000.00', $wallet->balance);
    }

    public function test_marking_a_completed_order_failed_does_not_refund_twice_if_router_already_refunded_it(): void
    {
        // Simulates an order OrderFulfillmentService::fulfill() itself
        // already resolved to 'failed' (and already refunded) BEFORE any
        // admin touches it -- e.g. the admin merely re-saves it (say, to
        // add an internal note) without changing its status at all.
        $user = User::factory()->create();
        $service = $this->makeService();
        $order = $this->makeWalletDebitedOrder($user, $service, 'failed');

        $wallet = Wallet::where('user_id', $user->id)->first();
        $wallet->increment('balance', $service->price);
        $wallet->transactions()->create([
            'wallet_id' => $wallet->id,
            'user_id' => $user->id,
            'type' => 'credit',
            'amount' => $service->price,
            'reference' => $order->reference.'-REFUND',
            'description' => 'Refund: order '.$order->reference.' (provider rejected the order (rejected))',
            'status' => 'success',
        ]);

        // previousStatus is ALREADY 'failed', so this save (status stays
        // 'failed') must not be treated as a transition into
        // failed/cancelled at all.
        $this->actingAs($this->admin())->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'failed',
        ])->assertOk();

        $this->assertSame(1, WalletTransaction::where('reference', $order->reference.'-REFUND')->count());
    }

    public function test_marking_a_legacy_never_debited_order_failed_does_not_create_a_free_refund(): void
    {
        $user = User::factory()->create();
        Wallet::create(['user_id' => $user->id, 'balance' => 1000, 'currency' => 'NGN']);
        $service = $this->makeService();
        $order = $this->makeUnbilledLegacyOrder($user, $service, 'pending');

        $this->actingAs($this->admin())->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'failed',
        ])->assertOk();

        $wallet = Wallet::where('user_id', $user->id)->first();
        $this->assertSame('1000.00', $wallet->balance);
        $this->assertDatabaseMissing('wallet_transactions', ['reference' => $order->reference.'-REFUND']);
    }

    public function test_marking_a_pending_order_completed_does_not_refund(): void
    {
        $user = User::factory()->create();
        $service = $this->makeService();
        $order = $this->makeWalletDebitedOrder($user, $service, 'pending');

        $this->actingAs($this->admin())->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'completed',
        ])->assertOk();

        $wallet = Wallet::where('user_id', $user->id)->first();
        $this->assertSame('460.00', $wallet->balance); // still debited, no refund
        $this->assertDatabaseMissing('wallet_transactions', ['reference' => $order->reference.'-REFUND']);
    }

    public function test_non_admin_cannot_update_order_status(): void
    {
        $user = User::factory()->create();
        $service = $this->makeService();
        $order = $this->makeWalletDebitedOrder($user, $service, 'pending');

        $this->actingAs($user)->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'failed',
        ])->assertForbidden();
    }
}
