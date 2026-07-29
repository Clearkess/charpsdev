<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Service;
use App\Models\Order;
use App\Models\Wallet;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function dashboard()
    {
        $users = User::count();
        $services = Service::count();
        $orders = Order::count();

        $completedOrders = Order::where('status', 'completed')->count();
        $pendingOrders = Order::where('status', 'pending')->count();

        $walletBalance = Wallet::sum('balance');

        $revenue = Order::where('status', 'completed')
            ->sum('amount');

        return response()->json([
            'success' => true,
            'data' => [
                'users' => $users,
                'services' => $services,
                'orders' => $orders,
                'completed_orders' => $completedOrders,
                'pending_orders' => $pendingOrders,
                'wallet_balance' => $walletBalance,
                'revenue' => $revenue,
            ]
        ]);
    }

    /**
     * Day-bucketed order count + completed-order revenue for the last N days
     * (default 30), used to power the admin dashboard charts. Every day in
     * the range is present in the response (zero-filled) so the frontend
     * doesn't need to handle gaps.
     */
    public function chartData()
    {
        $days = 30;
        $start = Carbon::now()->subDays($days - 1)->startOfDay();

        $orderRows = Order::query()
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders_count')
            ->where('created_at', '>=', $start)
            ->groupBy('day')
            ->pluck('orders_count', 'day');

        $revenueRows = Order::query()
            ->where('status', 'completed')
            ->selectRaw('DATE(created_at) as day, SUM(amount) as revenue')
            ->where('created_at', '>=', $start)
            ->groupBy('day')
            ->pluck('revenue', 'day');

        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $start->copy()->addDays($i)->toDateString();
            $series[] = [
                'date' => $date,
                'orders' => (int) ($orderRows[$date] ?? 0),
                'revenue' => (float) ($revenueRows[$date] ?? 0),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $series,
        ]);
    }
}
