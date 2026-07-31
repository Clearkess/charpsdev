<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Coupon::latest()->get(),
        ]);
    }

    public function store(Request $request)
    {
        // Normalize the code to uppercase *before* the uniqueness check
        // runs, so "save10" and "SAVE10" are treated as the same code
        // regardless of the DB's collation/case-sensitivity.
        if ($request->filled('code')) {
            $request->merge(['code' => Str::upper($request->input('code'))]);
        }

        $data = $request->validate([
            'code' => 'nullable|string|max:50|alpha_dash|unique:coupons,code',
            'type' => ['required', Rule::in(['percentage', 'fixed'])],
            'value' => 'required|numeric|min:0.01',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_uses' => 'nullable|integer|min:1',
            'expires_at' => 'nullable|date|after:now',
            'active' => 'boolean',
        ]);

        if ($data['type'] === 'percentage' && $data['value'] > 100) {
            return response()->json([
                'success' => false,
                'message' => 'A percentage coupon cannot exceed 100%.',
            ], 422);
        }

        $data['code'] = $data['code'] ?? Str::upper(Str::random(8));
        $data['active'] = $data['active'] ?? true;
        $data['used_count'] = 0;

        $coupon = Coupon::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Coupon created successfully.',
            'data' => $coupon,
        ], 201);
    }

    public function update(Request $request, Coupon $coupon)
    {
        $data = $request->validate([
            'type' => [Rule::in(['percentage', 'fixed'])],
            'value' => 'sometimes|numeric|min:0.01',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_uses' => 'nullable|integer|min:1',
            'expires_at' => 'nullable|date',
            'active' => 'boolean',
        ]);

        $type = $data['type'] ?? $coupon->type;
        $value = $data['value'] ?? $coupon->value;
        if ($type === 'percentage' && $value > 100) {
            return response()->json([
                'success' => false,
                'message' => 'A percentage coupon cannot exceed 100%.',
            ], 422);
        }

        $coupon->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Coupon updated successfully.',
            'data' => $coupon->fresh(),
        ]);
    }

    public function destroy(Coupon $coupon)
    {
        $coupon->delete();

        return response()->json([
            'success' => true,
            'message' => 'Coupon deleted successfully.',
        ]);
    }
}
