<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Notifications\OrderDeliveredNotification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Provider Router (Option B) — completes an Easylogs order that
 * EasylogsProvider::fulfill() left 'pending' (async fulfilment: Easylogs
 * accepted the request but hadn't delivered yet at request time).
 * OrderFulfillmentService maps a 'pending' per-line outcome to overall
 * order status 'processing' (see its resolveOrderStatus() — 'pending'
 * isn't 'completed', 'rejected', 'no_routes', or 'manual_review', so the
 * order falls through to 'processing'); this webhook is what actually
 * moves it to 'completed' once Easylogs confirms delivery, mirroring
 * exactly what AdminOrderController::update() does for a manual admin
 * completion (delivered_at, OrderDeliveredNotification, in-app
 * notification) so an async Easylogs delivery looks identical to an admin
 * marking the order delivered by hand.
 *
 * Matching: Easylogs' own delivery payload's `reference` is matched
 * against `orders.provider_reference` — the value ProviderRouter/
 * OrderFulfillmentService stored from EasylogsProvider::fulfill()'s
 * `external_reference` (see OrderFulfillmentService::fulfill()'s
 * `$firstProviderReference`). NOTE: for a multi-item cart order,
 * `orders.provider_reference` only ever holds the FIRST line's provider
 * reference (an existing Option A limitation, not introduced here) — a
 * webhook for a later line in a multi-item order won't resolve via this
 * column. Fine for the common case (one Easylogs-routed line per order);
 * revisit if/when multi-item async delivery needs full per-line tracking.
 */
class EasylogsWebhookController extends Controller
{
    public function handle(Request $request, NotificationService $notifications)
    {
        $configuredSecret = config('services.easylogs.webhook_secret');
        if ($configuredSecret) {
            $provided = (string) $request->header('X-Easylogs-Secret');
            if (! $provided || ! hash_equals($configuredSecret, $provided)) {
                return response()->json(['success' => false, 'message' => 'Unauthorized.'], 401);
            }
        }

        if ($request->input('event') !== 'order.delivered') {
            return response()->json(['success' => true, 'message' => 'Event ignored.']);
        }

        $data = $request->input('data', []);
        $reference = $data['reference'] ?? null;

        if (! $reference) {
            return response()->json(['success' => false, 'message' => 'Missing reference.'], 422);
        }

        $order = DB::transaction(function () use ($reference, $data) {
            $order = Order::where('provider_reference', $reference)
                ->lockForUpdate()
                ->first();

            if (! $order) {
                return null;
            }

            $wasAlreadyCompleted = $order->status === 'completed';

            $deliveryItems = $data['items'] ?? null;
            $deliveryContent = is_array($deliveryItems)
                ? collect($deliveryItems)->map(fn ($item) => is_string($item) ? $item : json_encode($item))->implode("\n")
                : ($order->delivery_content ?? null);

            $order->forceFill([
                'status' => 'completed',
                'delivery_content' => $deliveryContent,
                'delivered_at' => $order->delivered_at ?? now(),
                'details' => array_merge($order->details ?? [], [
                    'easylogs_webhook' => $data,
                ]),
            ])->save();

            return [$order->fresh(), $wasAlreadyCompleted];
        });

        if (! $order) {
            Log::warning('EasylogsWebhookController: no order matches provider_reference', ['reference' => $reference]);

            return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
        }

        [$order, $wasAlreadyCompleted] = $order;

        // Idempotent: a redelivered/duplicate webhook for an order already
        // marked completed must not re-send the delivery email or spam a
        // second in-app notification.
        if (! $wasAlreadyCompleted) {
            $order->loadMissing(['user', 'items.service', 'service']);

            if ($order->user) {
                try {
                    $order->user->notify(new OrderDeliveredNotification($order));
                } catch (\Throwable $e) {
                    Log::error('EasylogsWebhookController: failed to send delivery email', [
                        'order_id' => $order->id,
                        'error' => $e->getMessage(),
                    ]);
                }

                $notifications->notify(
                    $order->user,
                    'order',
                    'Order update',
                    "Your order {$order->reference} has been completed. Check your order for delivery details.",
                    '/orders/'.$order->id,
                );
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Easylogs delivery processed.',
            'reference' => $reference,
        ]);
    }
}
