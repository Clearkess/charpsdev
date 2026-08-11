<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Notifications\OrderDeliveredNotification;
use App\Services\NotificationService;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class AdminOrderController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Order::with(['user', 'service'])
                ->latest()
                ->paginate(20),
        ]);
    }

    public function show(Order $order)
    {
        return response()->json([
            'success' => true,
            'data' => $order->load(['user', 'service']),
        ]);
    }

    public function update(Request $request, Order $order, NotificationService $notifications, OrderFulfillmentService $fulfillment)
    {
        $data = $request->validate([
            'status' => [
                'required',
                Rule::in(['pending', 'processing', 'completed', 'failed', 'cancelled']),
            ],
            'provider_reference' => ['nullable', 'string', 'max:255'],
            'details' => ['nullable', 'array'],
            // Phase 5 (product delivery emails): whatever the admin needs to
            // hand the customer — a license key, PIN, download link, account
            // credentials, etc. Sending this alongside status "completed"
            // triggers OrderDeliveredNotification below.
            'delivery_content' => ['nullable', 'string', 'max:5000'],
        ]);

        $previousStatus = $order->status;
        $previousDeliveryContent = $order->delivery_content;

        $order->update($data);
        $order->refresh();

        // Track the first time an order is marked completed, without ever
        // overwriting an existing delivered_at on a later save.
        if ($order->status === 'completed' && $order->delivered_at === null) {
            $order->forceFill(['delivered_at' => now()])->save();
        }

        // Regression guard for a real production incident (order #18,
        // ORD-QZ4ITOZ7YE): an admin manually transitioning an order INTO
        // 'failed'/'cancelled' previously had no refund path at all — only
        // OrderFulfillmentService::fulfill()'s own automatic 'failed'
        // outcome ever credited the wallet back. A customer's money could
        // be silently kept with no refund and no record of one just
        // because a human, rather than the router, closed out the order.
        // refundIfNotAlready() is a no-op for an order that was never
        // wallet-debited in the first place (e.g. the legacy
        // OrderController::store() flow) or one that's already been
        // refunded (e.g. this order previously failed automatically and
        // OrderFulfillmentService::refund() already ran).
        $wasJustClosedAsUnfulfilled = in_array($order->status, ['failed', 'cancelled'], true)
            && ! in_array($previousStatus, ['failed', 'cancelled'], true);

        if ($wasJustClosedAsUnfulfilled) {
            $fulfillment->refundIfNotAlready($order, "admin marked order {$order->status}");
        }

        $order = $order->load(['user', 'service', 'items.service']);

        // Only email when the order just became completed, OR when the admin
        // supplied new/changed delivery content on an already-completed
        // order (e.g. they forgot to paste the code the first time). This
        // avoids re-sending the exact same email on every unrelated save.
        $isNewCompletion = $order->status === 'completed' && $previousStatus !== 'completed';
        $deliveryContentChanged = $order->status === 'completed'
            && array_key_exists('delivery_content', $data)
            && filled($data['delivery_content'])
            && $data['delivery_content'] !== $previousDeliveryContent;

        if ($order->user && ($isNewCompletion || $deliveryContentChanged)) {
            try {
                $order->user->notify(new OrderDeliveredNotification($order));
            } catch (\Throwable $e) {
                // A misconfigured mail transport must never block the order
                // status update itself — log and continue.
                Log::error('Failed to send order delivery email', [
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Phase 6 (more notification triggers): before this phase, a status
        // change only ever fired a push notification (silently a no-op
        // locally, and easy to miss even in production if the device isn't
        // subscribed) — nothing landed on the in-app Notifications page or
        // counted toward the unread badge, unlike "order placed" which does
        // both. Every status transition now writes an in-app row too.
        if ($order->user && $previousStatus !== $order->status) {
            $notifications->notify(
                $order->user,
                'order',
                'Order update',
                $this->statusMessage($order),
                '/orders/'.$order->id,
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Order updated successfully.',
            'data' => $order,
        ]);
    }

    private function statusMessage(Order $order): string
    {
        $ref = $order->reference;

        return match ($order->status) {
            'processing' => "Your order {$ref} is now being processed.",
            'completed' => "Your order {$ref} has been completed. Check your order for delivery details.",
            'failed' => "Your order {$ref} could not be completed and has failed. Please contact support if you were charged.",
            'cancelled' => "Your order {$ref} has been cancelled.",
            default => "Your order {$ref} status was updated to {$order->status}.",
        };
    }
}
