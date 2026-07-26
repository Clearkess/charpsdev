<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminWalletController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'wallets' => User::with('wallet')->latest()->get(),
        ]);
    }

    public function credit(Request $request, User $user)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
        ]);

        DB::transaction(function () use ($request, $user) {
            $wallet = Wallet::firstOrCreate(
                ['user_id' => $user->id],
                ['balance' => 0, 'currency' => 'NGN']
            );

            $wallet->increment('balance', $request->amount);

            $wallet->transactions()->create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => 'credit',
                'amount' => $request->amount,
                'reference' => uniqid('CRD-'),
                'description' => 'Admin wallet credit',
                'status' => 'success',
            ]);
        });

        return response()->json([
            'success' => true,
            'balance' => $user->wallet()->first()->balance,
        ]);
    }

    public function debit(Request $request, User $user)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
        ]);

        $wallet = Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'currency' => 'NGN']
        );

        if ((float) $wallet->balance < (float) $request->amount) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient balance.',
            ], 422);
        }

        DB::transaction(function () use ($request, $wallet, $user) {
            $wallet->decrement('balance', $request->amount);

            $wallet->transactions()->create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => 'debit',
                'amount' => $request->amount,
                'reference' => uniqid('DBT-'),
                'description' => 'Admin wallet debit',
                'status' => 'success',
            ]);
        });

        return response()->json([
            'success' => true,
            'balance' => $wallet->fresh()->balance,
        ]);
    }
}
