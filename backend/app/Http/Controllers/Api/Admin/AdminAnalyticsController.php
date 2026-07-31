<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class AdminAnalyticsController extends Controller
{
    /**
     * Every known order status, so breakdowns are always zero-filled rather
     * than omitting a status that had no orders in the selected range.
     */
    private const STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

    /**
     * Phase 8 (analytics): the pre-existing `AdminController::dashboard()` /
     * `chartData()` (already live in production, predating the 10-phase
     * roadmap) give a fixed-30-day at-a-glance view with no breakdown by
     * service/category or period selection. This is a new, additive
     * endpoint powering a separate `/admin/analytics` page rather than a
     * change to that already-shipped controller, so the existing dashboard
     * can never regress.
     */
    public function overview(Request $request)
    {
        $validated = $request->validate([
            'days' => ['sometimes', Rule::in([7, 30, 90, 365])],
        ]);
        $days = (int) ($validated['days'] ?? 30);
        $start = Carbon::now()->subDays($days - 1)->startOfDay();

        $completedInRange = Order::where('status', 'completed')
            ->where('created_at', '>=', $start)
            ->with(['items.service.categoryGroup', 'service.categoryGroup'])
            ->get();

        [$topServices, $revenueByCategory] = $this->serviceAndCategoryBreakdown($completedInRange);

        $ordersInRangeCount = Order::where('created_at', '>=', $start)->count();
        $revenueInRange = (float) $completedInRange->sum('amount');
        $averageOrderValue = $completedInRange->count() > 0
            ? round($revenueInRange / $completedInRange->count(), 2)
            : 0.0;

        $couponOrders = $completedInRange->whereNotNull('coupon_code');

        return response()->json([
            'success' => true,
            'data' => [
                'range_days' => $days,
                'summary' => [
                    'orders_in_range' => $ordersInRangeCount,
                    'completed_orders_in_range' => $completedInRange->count(),
                    'revenue_in_range' => $revenueInRange,
                    'average_order_value' => $averageOrderValue,
                    'new_users_in_range' => User::where('created_at', '>=', $start)->count(),
                ],
                'status_breakdown' => $this->statusBreakdown($start),
                'top_services' => $topServices,
                'revenue_by_category' => $revenueByCategory,
                'signups_series' => $this->dailySeries(
                    User::where('created_at', '>=', $start)->selectRaw('DATE(created_at) as day, COUNT(*) as count')->groupBy('day')->pluck('count', 'day'),
                    $days,
                    $start,
                ),
                'coupon_usage' => [
                    'redemptions' => $couponOrders->count(),
                    'total_discount' => (float) $couponOrders->sum('discount'),
                ],
            ],
        ]);
    }

    /**
     * Builds per-service and per-category revenue from completed orders,
     * handling both order shapes the same way Phase 5's
     * OrderDeliveredNotification does: cart-checkout orders (which have
     * `order_items` rows) use those; the older single-service
     * `POST /api/orders` orders (which never create `order_items`) fall
     * back to the order's own `service_id`/`amount`. A cart-checkout order
     * also sets `service_id` to its first item for backward compatibility,
     * so `items` is checked first to avoid double-counting.
     *
     * Note: per-item figures use the item's price x quantity (pre-discount
     * subtotal), not a proportional share of any coupon discount — so for
     * orders with a coupon applied, the sum of these figures can slightly
     * exceed `revenue_in_range` (which is post-discount). This is a
     * deliberate analytics simplification, not a bug: allocating a coupon's
     * discount proportionally across line items adds real complexity for a
     * number that's only ever used to rank services/categories relative to
     * each other, not for financial reconciliation (`revenue_in_range` and
     * the existing admin dashboard's `revenue` remain the source of truth
     * for actual money collected).
     *
     * @return array{0: array<int, array{service_id: int|null, name: string, orders: int, revenue: float}>, 1: array<int, array{category: string, revenue: float}>}
     */
    private function serviceAndCategoryBreakdown($completedOrders): array
    {
        $services = [];
        $categories = [];

        $addLine = function (?int $serviceId, string $name, string $category, float $lineRevenue) use (&$services, &$categories) {
            $key = $serviceId ?? $name;
            $services[$key] ??= ['service_id' => $serviceId, 'name' => $name, 'orders' => 0, 'revenue' => 0.0];
            $services[$key]['orders']++;
            $services[$key]['revenue'] += $lineRevenue;

            $categories[$category] = ($categories[$category] ?? 0.0) + $lineRevenue;
        };

        foreach ($completedOrders as $order) {
            if ($order->items->isNotEmpty()) {
                foreach ($order->items as $item) {
                    $service = $item->service;
                    $name = $service?->name ?? 'Unknown service';
                    $category = $service?->categoryGroup?->name ?? $service?->category ?? 'Uncategorized';
                    $addLine($service?->id, $name, $category, (float) $item->price * $item->quantity);
                }
            } elseif ($order->service_id) {
                $service = $order->service;
                $name = $service?->name ?? ($order->details['service_name'] ?? 'Unknown service');
                $category = $service?->categoryGroup?->name ?? $service?->category ?? 'Uncategorized';
                $addLine($order->service_id, $name, $category, (float) $order->amount);
            }
        }

        $topServices = collect($services)
            ->sortByDesc('revenue')
            ->take(10)
            ->values()
            ->map(fn ($row) => [
                'service_id' => $row['service_id'],
                'name' => $row['name'],
                'orders' => $row['orders'],
                'revenue' => round($row['revenue'], 2),
            ])
            ->all();

        $revenueByCategory = collect($categories)
            ->map(fn ($revenue, $category) => ['category' => $category, 'revenue' => round($revenue, 2)])
            ->sortByDesc('revenue')
            ->values()
            ->all();

        return [$topServices, $revenueByCategory];
    }

    /**
     * @return array<int, array{status: string, count: int}>
     */
    private function statusBreakdown(Carbon $start): array
    {
        $counts = Order::where('created_at', '>=', $start)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return collect(self::STATUSES)
            ->map(fn ($status) => ['status' => $status, 'count' => (int) ($counts[$status] ?? 0)])
            ->all();
    }

    /**
     * Zero-fills every day in the range, mirroring the existing pattern in
     * AdminController::chartData() so the frontend never has to handle gaps.
     *
     * @return array<int, array{date: string, count: int}>
     */
    private function dailySeries($countsByDay, int $days, Carbon $start): array
    {
        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $start->copy()->addDays($i)->toDateString();
            $series[] = [
                'date' => $date,
                'count' => (int) ($countsByDay[$date] ?? 0),
            ];
        }

        return $series;
    }
}
