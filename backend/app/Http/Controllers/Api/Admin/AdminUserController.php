<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;

class AdminUserController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'users' => User::with('wallet')->latest()->get(),
        ]);
    }

    public function show(User $user)
    {
        return response()->json([
            'success' => true,
            'user' => $user->load('wallet', 'orders'),
        ]);
    }

    public function suspend(User $user)
    {
        $user->update([
            'active' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'User suspended.',
        ]);
    }

    public function activate(User $user)
    {
        $user->update([
            'active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'User activated.',
        ]);
    }
}
