<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Service;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\NotificationService;
use App\Services\OrderFulfillmentService;
use App\Services\WebPushService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    /**
     * Checkout the authenticated user's entire cart in a single order, paid
     * from their wallet balance:
     *
     *   Cart -> validate stock + balance -> debit wallet -> create order +
     *   order_items -> decrement stock -> clear cart -> notify user.
     *
     * Everything up to "clear cart" happens inside one DB transaction with
     * row locks on the wallet and each service, so concurrent checkouts /
     * stock races can't result in a negative balance or oversold stock.
     *
     * Provider Router (Option A): once that transaction commits, any
     * service on this order that has an enabled provider-routing chain
     * configured gets routed through ProviderRouter/OrderFulfillmentService
     * for real upstream fulfilment (with automatic failover) — deliberately
     * OUTSIDE the transaction above, since a routing attempt can make
     * several slow third-party HTTP calls and must never hold the wallet
     * row lock while doing so (same pattern as VirtualNumberService). A
     * service with no routing configured is completely unaffected and
     * keeps today's exact behaviour: order stays 'pending' for an admin to
     * complete manually.
     */
    public function store(Request $request, WebPushService $webPush, NotificationService $notifications, OrderFulfillmentService $fulfillment)
    {
        $userId = $request->user()->id;

        $cartItems = CartItem::with('service')
            ->where('user_id', $userId)
            ->get();

        if ($cartItems->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Your cart is empty.',
            ], 422);
        }

        foreach ($cartItems as $item) {
            if (! $item->service || ! $item->service->active) {
                return response()->json([
                    'success' => false,
                    'message' => "\"{$item->service?->name}\" is no longer available. Please remove it from your cart.",
                ], 422);
            }
        }

        $couponCode = $request->filled('coupon_code') ? Str::upper(trim($request->input('coupon_code'))) : null;

        // Phase 6 (more notification triggers): populated (by reference)
        // whenever this checkout's stock decrement causes a service to cross
        // from above to at-or-below Service::LOW_STOCK_THRESHOLD, so admins
        // can be alerted once the transaction safely commits, without having
        // to re-derive "before" stock levels afterwards.
        $lowStockAlerts = [];

        try {
            $order = DB::transaction(function () use ($cartItems, $userId, $couponCode, &$lowStockAlerts) {
                // Lock every affected service row to prevent concurrent
                // checkouts from overselling limited stock.
                $lockedServices = Service::query()
                    ->whereIn('id', $cartItems->pluck('service_id'))
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                $subtotal = 0.0;
                foreach ($cartItems as $item) {
                    $service = $lockedServices[$item->service_id];

                    if (! $service->hasStockFor($item->quantity)) {
                        throw ValidationException::withMessages([
                            'cart' => "Only {$service->stock} unit(s) of \"{$service->name}\" left in stock.",
                        ]);
                    }

                    $subtotal += (float) $service->price * $item->quantity;
                }
                $subtotal = round($subtotal, 2);

                // Coupon is locked for the duration of this transaction so
                // two concurrent checkouts sharing the last remaining use
                // of a `max_uses`-limited coupon can't both succeed.
                $coupon = null;
                $discount = 0.0;
                if ($couponCode) {
                    $coupon = Coupon::where('code', $couponCode)->lockForUpdate()->first();

                    if (! $coupon || ! $coupon->isValidFor($subtotal)) {
                        throw ValidationException::withMessages([
                            'coupon_code' => 'This coupon code is invalid, expired, or no longer applicable to your order.',
                        ]);
                    }

                    $discount = $coupon->discountFor($subtotal);
                }

                $total = round($subtotal - $discount, 2);

                $wallet = Wallet::where('user_id', $userId)->lockForUpdate()->first();
                $wallet ??= Wallet::create(['user_id' => $userId, 'balance' => 0, 'currency' => 'NGN']);

                if ((float) $wallet->balance < $total) {
                    throw ValidationException::withMessages([
                        'wallet' => 'Insufficient wallet balance. Please fund your wallet and try again.',
                    ]);
                }

                $reference = 'ORD-'.Str::upper(Str::random(10));
                $firstItem = $cartItems->first();
                $firstService = $lockedServices[$firstItem->service_id];

                $order = Order::create([
                    'user_id' => $userId,
                    'service_id' => $firstService->id,
                    'reference' => $reference,
                    'order_number' => $reference,
                    'quantity' => $firstItem->quantity,
                    'amount' => $total,
                    'total' => $total,
                    'coupon_code' => $coupon?->code,
                    'discount' => $coupon ? $discount : null,
                    'status' => 'pending',
                    'payment_method' => 'wallet',
                    'details' => [
                        'items' => $cartItems->map(fn ($item) => [
                            'service_name' => $lockedServices[$item->service_id]->name,
                            'unit_price' => (float) $lockedServices[$item->service_id]->price,
                            'quantity' => $item->quantity,
                        ])->all(),
                        'subtotal' => $subtotal,
                    ],
                ]);

                if ($coupon) {
                    $coupon->increment('used_count');
                }

                foreach ($cartItems as $item) {
                    $service = $lockedServices[$item->service_id];

                    OrderItem::create([
                        'order_id' => $order->id,
                        'service_id' => $service->id,
                        'quantity' => $item->quantity,
                        'price' => $service->price,
                    ]);

                    if ($service->stock !== null) {
                        $stockBefore = $service->stock;
                        $stockAfter = $stockBefore - $item->quantity;
                        $service->decrement('stock', $item->quantity);

                        if ($stockBefore > Service::LOW_STOCK_THRESHOLD && $stockAfter <= Service::LOW_STOCK_THRESHOLD) {
                            $lowStockAlerts[] = ['name' => $service->name, 'stock' => $stockAfter];
                        }
                    }
                }

                $wallet->decrement('balance', $total);

                // wallet_transactions.type is a strict credit/debit enum; the
                // human-readable "purchase" context lives in the description
                // (and in the separate free-text `transactions.type` below).
                $wallet->transactions()->create([
                    'wallet_id' => $wallet->id,
                    'user_id' => $userId,
                    'type' => 'debit',
                    'amount' => $total,
                    'reference' => $reference,
                    'description' => 'Purchase: order '.$reference.' ('.$cartItems->count().' item'.($cartItems->count() === 1 ? '' : 's').')',
                    'status' => 'success',
                ]);

                Transaction::create([
                    'user_id' => $userId,
                    'reference' => $reference,
                    'amount' => $total,
                    'currency' => $wallet->currency ?? 'NGN',
                    'status' => 'success',
                    'type' => 'purchase',
                    'gateway' => 'wallet',
                    'description' => 'Purchase: order '.$reference.' ('.$cartItems->count().' item'.($cartItems->count() === 1 ? '' : 's').')',
                ]);

                CartItem::where('user_id', $userId)->delete();

                return $order;
            });
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Checkout failed.',
            ], 422);
        }

        $order = $fulfillment->fulfill($order->fresh());
        $order->load(['items.service', 'user']);

        Notification::create([
            'user_id' => $userId,
            'title' => 'Order placed',
            'message' => "Your order {$order->reference} for ".number_format((float) $order->total, 2).' has been placed and is being processed.',
            'type' => 'order',
        ]);

        $webPush->sendToUser($order->user, [
            'title' => 'Order placed',
            'body' => "Order {$order->reference} has been placed.",
            'url' => '/orders/'.$order->id,
        ]);

        // Phase 6 (more notification triggers): admin-facing rather than
        // user-facing - tells every admin, once per checkout that pushes a
        // service at or below Service::LOW_STOCK_THRESHOLD, so they can
        // restock before it hits zero. Fired outside the transaction (stock
        // is already committed) and guarded so a checkout that doesn't
        // cross the threshold never touches this at all.
        if (! empty($lowStockAlerts)) {
            $summary = collect($lowStockAlerts)
                ->map(fn ($alert) => "{$alert['name']} ({$alert['stock']} left)")
                ->implode(', ');

            foreach (User::where('is_admin', true)->get() as $admin) {
                $notifications->notify(
                    $admin,
                    'stock',
                    'Low stock alert',
                    "The following item(s) are running low on stock: {$summary}.",
                    '/admin/services',
                );
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Order placed successfully.',
            'data' => $order,
        ], 201);
    }
}
