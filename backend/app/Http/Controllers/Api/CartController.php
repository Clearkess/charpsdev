<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Service;
use Illuminate\Http\Request;

class CartController extends Controller
{
    /**
     * List the authenticated user's cart, with each line's service loaded
     * and a computed subtotal, plus a running cart total.
     */
    public function index(Request $request)
    {
        $items = CartItem::with('service.categoryGroup')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        $items->each(function (CartItem $item) {
            $item->subtotal = $item->service
                ? round((float) $item->service->price * $item->quantity, 2)
                : 0;
        });

        return response()->json([
            'success' => true,
            'data' => $items,
            'total' => round($items->sum('subtotal'), 2),
        ]);
    }

    /**
     * Add a service to the cart, or increment quantity if it's already
     * present. Validates the service is active and (if stock is tracked)
     * that enough stock exists for the resulting quantity.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'service_id' => ['required', 'exists:services,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        $service = Service::where('active', true)->findOrFail($data['service_id']);
        $quantity = (int) ($data['quantity'] ?? 1);

        $existing = CartItem::where('user_id', $request->user()->id)
            ->where('service_id', $service->id)
            ->first();

        $newQuantity = $quantity + ($existing->quantity ?? 0);

        if (! $service->hasStockFor($newQuantity)) {
            return response()->json([
                'success' => false,
                'message' => "Only {$service->stock} unit(s) of \"{$service->name}\" left in stock.",
            ], 422);
        }

        if ($existing) {
            $existing->update(['quantity' => $newQuantity]);
            $item = $existing;
        } else {
            $item = CartItem::create([
                'user_id' => $request->user()->id,
                'service_id' => $service->id,
                'quantity' => $quantity,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Added to cart.',
            'data' => $item->load('service.categoryGroup'),
        ], 201);
    }

    public function update(Request $request, CartItem $cartItem)
    {
        abort_unless($cartItem->user_id === $request->user()->id, 403, 'Unauthorized.');

        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        if (! $cartItem->service->hasStockFor($data['quantity'])) {
            return response()->json([
                'success' => false,
                'message' => "Only {$cartItem->service->stock} unit(s) of \"{$cartItem->service->name}\" left in stock.",
            ], 422);
        }

        $cartItem->update(['quantity' => $data['quantity']]);

        return response()->json([
            'success' => true,
            'message' => 'Cart updated.',
            'data' => $cartItem->load('service.categoryGroup'),
        ]);
    }

    public function destroy(Request $request, CartItem $cartItem)
    {
        abort_unless($cartItem->user_id === $request->user()->id, 403, 'Unauthorized.');

        $cartItem->delete();

        return response()->json([
            'success' => true,
            'message' => 'Removed from cart.',
        ]);
    }

    public function clear(Request $request)
    {
        CartItem::where('user_id', $request->user()->id)->delete();

        return response()->json([
            'success' => true,
            'message' => 'Cart cleared.',
        ]);
    }
}
