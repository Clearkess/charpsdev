<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

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

    /**
     * Legacy direct order creation bypassed wallet debit and stock handling.
     * Purchases must go through POST /api/checkout so payment, order creation,
     * stock changes, and ledger entries remain atomic.
     */
    public function store()
    {
        return response()->json([
            'success' => false,
            'message' => 'Direct order creation is disabled. Add services to your cart and complete wallet checkout.',
            'checkout_url' => '/api/checkout',
        ], 410);
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
