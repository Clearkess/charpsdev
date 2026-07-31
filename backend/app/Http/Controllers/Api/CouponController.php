<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CouponController extends Controller
{
    /**
     * Read-only preview used by the Cart page to show a discount amount
     * before the user commits to checkout. Deliberately does NOT lock the
     * row or touch `used_count` — the only place a coupon is authoritatively
     * validated and consumed is inside CheckoutController's DB transaction.
     * A coupon that passes this preview can still be rejected at checkout
     * (e.g. someone else used the last of a limited-use coupon in between).
     */
    public function validateCode(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:50',
            'subtotal' => 'required|numeric|min:0',
        ]);

        $coupon = Coupon::where('code', Str::upper(trim($data['code'])))->first();

        if (! $coupon || ! $coupon->isValidFor((float) $data['subtotal'])) {
            return response()->json([
                'success' => false,
                'message' => 'This coupon code is invalid, expired, or no longer applicable to your order.',
            ], 422);
        }

        $discount = $coupon->discountFor((float) $data['subtotal']);

        return response()->json([
            'success' => true,
            'data' => [
                'code' => $coupon->code,
                'type' => $coupon->type,
                'value' => $coupon->value,
                'discount' => $discount,
                'total_after_discount' => round((float) $data['subtotal'] - $discount, 2),
            ],
        ]);
    }
}
