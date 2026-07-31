<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Notifications\OrderDeliveredNotification;
use App\Services\WebPushService;
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

    public function update(Request $request, Order $order, WebPushService $webPush)
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

        if ($order->user && $previousStatus !== $order->status) {
            $webPush->sendToUser($order->user, [
                'title' => 'Order update',
                'body' => sprintf(
                    'Your order%s is now %s.',
                    $order->service ? " for {$order->service->name}" : '',
                    $order->status,
                ),
                'url' => '/orders/' . $order->id,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Order updated successfully.',
            'data' => $order,
        ]);
    }
}
