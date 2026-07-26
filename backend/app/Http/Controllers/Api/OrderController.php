<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Models\Order;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $orders = $request->user()
            ->orders()
            ->with('service')
            ->latest()
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    public function store(StoreOrderRequest $request)
    {
        $data = $request->validated();
        $service = Service::query()->where('active', true)->findOrFail($data['service_id']);
        $quantity = (int) $data['quantity'];
        $amount = (float) $service->price * $quantity;

        $order = Order::create([
            'user_id' => $request->user()->id,
            'service_id' => $service->id,
            'reference' => 'ORD-' . Str::upper(Str::random(10)),
            'quantity' => $quantity,
            'amount' => $amount,
            'details' => [
                'service_name' => $service->name,
                'unit_price' => (float) $service->price,
                'quantity' => $quantity,
            ],
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Order created successfully.',
            'data' => $order->load('service'),
        ], 201);
    }

    public function show(Order $order, Request $request)
    {
        abort_unless($order->user_id === $request->user()->id, 403, 'Unauthorized.');

        return response()->json([
            'success' => true,
            'data' => $order->load('service'),
        ]);
    }
}
