<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Provider Router (Option A), step 5 — the FIRST real fulfilment
 * integration for regular (non-virtual-number) Service orders.
 *
 * Before this, CheckoutController::store() debited the wallet, created the
 * Order as 'pending', decremented stock, and stopped — no upstream call of
 * any kind (confirmed by reading the full method). This service is called
 * right after that transaction commits (never inside it — a
 * ProviderRouter attempt can make several slow HTTP calls across multiple
 * providers, and must never hold the wallet row lock while doing so; same
 * "debit inside a short txn, call provider outside it, finalize/refund in
 * a second short txn" shape as VirtualNumberService::buyNumber()).
 *
 * Scope note (Option A): only Services that actually have an enabled
 * service_provider_routes chain get routed through ProviderRouter at all.
 * A Service with no routes configured yet falls back to exactly today's
 * behaviour (order stays 'pending' for an admin to complete manually via
 * AdminOrderController) — this keeps every existing category/service
 * working unchanged while the 'vtu' category (or whichever an admin wires
 * up routes for) gets real automatic failover.
 */
class OrderFulfillmentService
{
    public function __construct(
        private readonly ProviderRouter $router,
    ) {}

    /**
     * @return Order the same order, refreshed with its final status.
     */
    public function fulfill(Order $order): Order
    {
        $order->loadMissing(['items.service', 'service']);

        // Single-service legacy orders have no order_items rows; a
        // checkout-created order always has >=1. Normalize to one shape.
        $lines = $order->items->isNotEmpty()
            ? $order->items->map(fn ($item) => ['service' => $item->service, 'quantity' => $item->quantity, 'key' => 'I'.$item->id])->all()
            : ($order->service ? [['service' => $order->service, 'quantity' => $order->quantity ?? 1, 'key' => 'S']] : []);

        $lines = array_filter($lines, fn ($line) => $line['service'] !== null);

        if (empty($lines)) {
            Log::warning('OrderFulfillmentService: order has no resolvable service lines, leaving as-is', ['order_id' => $order->id]);

            return $order;
        }

        $attemptsByLine = [];
        $outcomes = [];
        $firstProviderReference = null;
        $firstProviderId = null;

        foreach ($lines as $line) {
            $service = $line['service'];

            // No routing configured for this service at all -> today's
            // exact behaviour: leave it out of routing entirely, order
            // stays pending for manual admin completion.
            if (! $service->providerRoutes()->where('enabled', true)->exists()) {
                $outcomes[] = 'unrouted';

                continue;
            }

            $result = $this->router->route(
                $service,
                $order,
                requestContext: [
                    'quantity' => $line['quantity'],
                    'amount' => (float) $service->price * $line['quantity'],
                    'recipient' => null,
                ],
                baseReference: $order->reference.'-'.$line['key'],
            );

            $attemptsByLine[$line['key']] = $result;
            $outcomes[] = $result['outcome'];

            if ($firstProviderReference === null && $result['provider_reference'] !== null) {
                $firstProviderReference = $result['provider_reference'];
                $firstProviderId = $result['provider_id'];
            }
        }

        $newStatus = $this->resolveOrderStatus($outcomes);

        $order->forceFill([
            'status' => $newStatus,
            'provider_reference' => $firstProviderReference ?? $order->provider_reference,
            'details' => array_merge($order->details ?? [], [
                'provider_router' => [
                    'attempts_by_line' => $attemptsByLine,
                    'resolved_at' => now()->toIso8601String(),
                ],
            ]),
        ])->save();

        if ($newStatus === 'completed' && $order->delivered_at === null) {
            $order->forceFill(['delivered_at' => now()])->save();
        }

        if ($newStatus === 'failed') {
            $this->refund($order, 'provider rejected the order ('.implode(', ', array_unique($outcomes)).')');
        }

        return $order->fresh();
    }

    /**
     * Maps this order's per-line ProviderRouter outcomes to a single
     * orders.status value (the existing enum: pending/processing/
     * completed/failed/cancelled — see 2026_07_20_164350_create_orders_table.php).
     *
     * - Any line 'unrouted' alongside otherwise-successful lines still
     *   counts as 'processing' (not 'completed') — a human still needs to
     *   deliver the unrouted line manually.
     * - Any 'rejected' line fails the WHOLE order (simplest, safest
     *   Option-A behaviour for a multi-item cart: a definitively-rejected
     *   line means we should not silently keep the rest "done" while
     *   quietly failing to deliver one item the customer paid for) and
     *   triggers a full refund.
     * - Any 'no_routes'/'manual_review' line, with no rejections, leaves
     *   the order at 'pending' — exactly like today's unrouted default —
     *   for a human to look at (the ambiguous-timeout case specifically
     *   must never be auto-resolved either way).
     */
    private function resolveOrderStatus(array $outcomes): string
    {
        if (in_array('rejected', $outcomes, true)) {
            return 'failed';
        }

        if (in_array('no_routes', $outcomes, true) || in_array('manual_review', $outcomes, true)) {
            return 'pending';
        }

        $allUnrouted = ! empty($outcomes) && count(array_unique($outcomes)) === 1 && $outcomes[0] === 'unrouted';
        if ($allUnrouted) {
            return 'pending';
        }

        $allCompleted = ! empty($outcomes) && collect($outcomes)->every(fn ($o) => $o === 'completed' || $o === 'unrouted')
            && in_array('completed', $outcomes, true);
        if ($allCompleted) {
            return 'completed';
        }

        // Mix of completed/pending/unrouted, or all pending -> still being
        // fulfilled / needs manual finishing for the unrouted part.
        return 'processing';
    }

    /**
     * Credits the customer's wallet back for the full order total. Runs in
     * its own short transaction with a fresh wallet lock, mirroring
     * VirtualNumberService::refund() — the debit transaction that created
     * this order has already committed by the time fulfil() can run.
     */
    private function refund(Order $order, string $reason): void
    {
        DB::transaction(function () use ($order, $reason) {
            $wallet = Wallet::where('user_id', $order->user_id)->lockForUpdate()->first();

            if (! $wallet) {
                Log::error('OrderFulfillmentService::refund - no wallet found', ['order_id' => $order->id]);

                return;
            }

            $amount = (float) $order->total ?: (float) $order->amount;

            $wallet->increment('balance', $amount);

            $wallet->transactions()->create([
                'wallet_id' => $wallet->id,
                'user_id' => $order->user_id,
                'type' => 'credit',
                'amount' => $amount,
                'reference' => $order->reference.'-REFUND',
                'description' => "Refund: order {$order->reference} ({$reason})",
                'status' => 'success',
            ]);

            Transaction::create([
                'user_id' => $order->user_id,
                'reference' => $order->reference.'-REFUND',
                'amount' => $amount,
                'status' => 'success',
                'type' => 'refund',
                'gateway' => 'wallet',
                'description' => "Refund: order {$order->reference} ({$reason})",
            ]);
        });
    }
}
