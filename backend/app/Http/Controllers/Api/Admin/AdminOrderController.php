<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
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

    public function update(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => [
                'required',
                Rule::in(['pending', 'processing', 'completed', 'failed', 'cancelled']),
            ],
            'provider_reference' => ['nullable', 'string', 'max:255'],
            'details' => ['nullable', 'array'],
        ]);

        $order->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Order updated successfully.',
            'data' => $order->fresh()->load(['user', 'service']),
        ]);
    }
}
