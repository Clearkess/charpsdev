<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Wallet;
use App\Models\WalletTransaction;
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
     * Everything happens inside one DB transaction with row locks on the
     * wallet and each service, so concurrent checkouts / stock races can't
     * result in a negative balance or oversold stock.
     */
    public function store(Request $request, WebPushService $webPush)
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

        try {
            $order = DB::transaction(function () use ($cartItems, $userId, $request) {
                // Lock every affected service row to prevent concurrent
                // checkouts from overselling limited stock.
                $lockedServices = \App\Models\Service::query()
                    ->whereIn('id', $cartItems->pluck('service_id'))
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                $total = 0.0;
                foreach ($cartItems as $item) {
                    $service = $lockedServices[$item->service_id];

                    if (! $service->hasStockFor($item->quantity)) {
                        throw ValidationException::withMessages([
                            'cart' => "Only {$service->stock} unit(s) of \"{$service->name}\" left in stock.",
                        ]);
                    }

                    $total += (float) $service->price * $item->quantity;
                }
                $total = round($total, 2);

                $wallet = Wallet::where('user_id', $userId)->lockForUpdate()->first();
                $wallet ??= Wallet::create(['user_id' => $userId, 'balance' => 0, 'currency' => 'NGN']);

                if ((float) $wallet->balance < $total) {
                    throw ValidationException::withMessages([
                        'wallet' => 'Insufficient wallet balance. Please fund your wallet and try again.',
                    ]);
                }

                $reference = 'ORD-' . Str::upper(Str::random(10));
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
                    'status' => 'pending',
                    'payment_method' => 'wallet',
                    'details' => [
                        'items' => $cartItems->map(fn ($item) => [
                            'service_name' => $lockedServices[$item->service_id]->name,
                            'unit_price' => (float) $lockedServices[$item->service_id]->price,
                            'quantity' => $item->quantity,
                        ])->all(),
                    ],
                ]);

                foreach ($cartItems as $item) {
                    $service = $lockedServices[$item->service_id];

                    OrderItem::create([
                        'order_id' => $order->id,
                        'service_id' => $service->id,
                        'quantity' => $item->quantity,
                        'price' => $service->price,
                    ]);

                    if ($service->stock !== null) {
                        $service->decrement('stock', $item->quantity);
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
                    'description' => 'Purchase: order ' . $reference . ' (' . $cartItems->count() . ' item' . ($cartItems->count() === 1 ? '' : 's') . ')',
                    'status' => 'success',
                ]);

                \App\Models\Transaction::create([
                    'user_id' => $userId,
                    'reference' => $reference,
                    'amount' => $total,
                    'status' => 'success',
                    'type' => 'purchase',
                    'gateway' => 'wallet',
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

        $order = $order->fresh()->load(['items.service', 'user']);

        Notification::create([
            'user_id' => $userId,
            'title' => 'Order placed',
            'message' => "Your order {$order->reference} for " . number_format((float) $order->total, 2) . ' has been placed and is being processed.',
            'type' => 'order',
        ]);

        $webPush->sendToUser($order->user, [
            'title' => 'Order placed',
            'body' => "Order {$order->reference} has been placed.",
            'url' => '/orders/' . $order->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Order placed successfully.',
            'data' => $order,
        ], 201);
    }
}
