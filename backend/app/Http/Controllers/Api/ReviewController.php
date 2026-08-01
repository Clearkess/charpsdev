<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Review;
use App\Models\Service;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

/**
 * Phase 9 (user-facing features): service reviews/ratings. A review may
 * only be left by a user who has an order (in either the cart-checkout
 * order_items shape or the legacy single-service shape — the same
 * dual-shape check used since Phase 5/8) containing this service with
 * status "completed". Resubmitting updates the existing review in place
 * (unique user_id+service_id index), it never creates a second row.
 */
class ReviewController extends Controller
{
    use ApiResponse;

    public function index(Request $request, Service $service)
    {
        $reviews = Review::with('user:id,name')
            ->where('service_id', $service->id)
            ->latest()
            ->get();

        return $this->success([
            'reviews' => $reviews,
            'average_rating' => $reviews->count() ? round((float) $reviews->avg('rating'), 2) : null,
            'reviews_count' => $reviews->count(),
            'my_review' => $request->user()
                ? $reviews->firstWhere('user_id', $request->user()->id)
                : null,
        ], 'Reviews retrieved successfully.');
    }

    public function store(Request $request, Service $service)
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $eligibleOrder = Order::where('user_id', $request->user()->id)
            ->where('status', 'completed')
            ->where(function ($query) use ($service) {
                $query->where('service_id', $service->id)
                    ->orWhereHas('items', function ($itemQuery) use ($service) {
                        $itemQuery->where('service_id', $service->id);
                    });
            })
            ->latest()
            ->first();

        if (! $eligibleOrder) {
            return $this->error(
                'You can only review a service after a completed order for it.',
                403,
            );
        }

        $review = Review::updateOrCreate(
            ['user_id' => $request->user()->id, 'service_id' => $service->id],
            [
                'order_id' => $eligibleOrder->id,
                'rating' => $data['rating'],
                'comment' => $data['comment'] ?? null,
            ],
        );

        return $this->success(
            $review->load('user:id,name'),
            $review->wasRecentlyCreated ? 'Review submitted successfully.' : 'Review updated successfully.',
            $review->wasRecentlyCreated ? 201 : 200,
        );
    }
}
