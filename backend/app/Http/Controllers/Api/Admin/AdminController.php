<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Service;
use App\Models\Order;
use App\Models\Wallet;

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
}
