<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminWalletController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'wallets' => User::with('wallet')->latest()->get(),
        ]);
    }

    /**
     * Phase 2 (Wallet Refinements): every user-visible transaction list is
     * fed by the `transactions` table (see WalletController::transactions),
     * so this drill-down reads the same table/shape rather than the
     * separate `wallet_transactions` ledger, keeping "what the admin sees
     * for this user" consistent with "what the user sees for themselves".
     */
    public function transactions(User $user)
    {
        $transactions = Transaction::where('user_id', $user->id)
            ->latest()
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
    }

    public function credit(Request $request, User $user, NotificationService $notifications)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
            'reason' => 'nullable|string|max:255',
        ]);

        $reason = $request->input('reason');

        DB::transaction(function () use ($request, $user, $reason) {
            $wallet = Wallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            $wallet ??= Wallet::create(['user_id' => $user->id, 'balance' => 0, 'currency' => 'NGN']);

            $wallet->increment('balance', $request->amount);

            $reference = 'CRD-' . Str::upper(Str::random(10));
            $description = $reason ? "Admin wallet credit: {$reason}" : 'Admin wallet credit';

            $wallet->transactions()->create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => 'credit',
                'amount' => $request->amount,
                'reference' => $reference,
                'description' => $description,
                'status' => 'success',
            ]);

            // Also write to `transactions`, the ledger the user-facing
            // Wallet page and GET /wallet/transactions actually read.
            // Previously this endpoint only wrote to `wallet_transactions`,
            // so an admin credit changed the balance but never appeared in
            // the affected user's own transaction history.
            Transaction::create([
                'user_id' => $user->id,
                'reference' => $reference,
                'amount' => $request->amount,
                'currency' => $wallet->currency ?? 'NGN',
                'status' => 'success',
                'type' => 'credit',
                'gateway' => 'admin',
                'description' => $description,
            ]);
        });

        // Phase 6 (more notification triggers): an admin-initiated credit
        // previously updated the balance and both ledgers (Phase 2's fix)
        // but never told the affected user at all.
        $notifications->notify(
            $user,
            'wallet',
            'Wallet credited',
            'Your wallet was credited with ' . number_format((float) $request->amount, 2) . ' NGN by an admin'
                . ($reason ? " ({$reason})." : '.'),
            '/wallet',
        );

        return response()->json([
            'success' => true,
            'balance' => $user->wallet()->first()->balance,
        ]);
    }

    public function debit(Request $request, User $user, NotificationService $notifications)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
            'reason' => 'nullable|string|max:255',
        ]);

        $reason = $request->input('reason');
        $debited = false;

        try {
            DB::transaction(function () use ($request, $user, $reason, &$debited) {
                $wallet = Wallet::query()
                    ->where('user_id', $user->id)
                    ->lockForUpdate()
                    ->first();
                $wallet ??= Wallet::create(['user_id' => $user->id, 'balance' => 0, 'currency' => 'NGN']);

                if ((float) $wallet->balance < (float) $request->amount) {
                    throw ValidationException::withMessages([
                        'amount' => 'Insufficient balance.',
                    ]);
                }

                $wallet->decrement('balance', $request->amount);

                $reference = 'DBT-' . Str::upper(Str::random(10));
                $description = $reason ? "Admin wallet debit: {$reason}" : 'Admin wallet debit';

                $wallet->transactions()->create([
                    'wallet_id' => $wallet->id,
                    'user_id' => $user->id,
                    'type' => 'debit',
                    'amount' => $request->amount,
                    'reference' => $reference,
                    'description' => $description,
                    'status' => 'success',
                ]);

                Transaction::create([
                    'user_id' => $user->id,
                    'reference' => $reference,
                    'amount' => $request->amount,
                    'currency' => $wallet->currency ?? 'NGN',
                    'status' => 'success',
                    'type' => 'debit',
                    'gateway' => 'admin',
                    'description' => $description,
                ]);

                $debited = true;
            });
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Debit failed.',
            ], 422);
        }

        // Phase 6 (more notification triggers): mirrors the credit()
        // notification above. Guarded by $debited (only set true once the
        // transaction body actually runs to completion) so an
        // insufficient-balance rejection above never reaches this point in
        // the first place (the try/catch's early return already handles
        // that) - this flag just documents the invariant explicitly.
        if ($debited) {
            $notifications->notify(
                $user,
                'wallet',
                'Wallet debited',
                'Your wallet was debited ' . number_format((float) $request->amount, 2) . ' NGN by an admin'
                    . ($reason ? " ({$reason})." : '.'),
                '/wallet',
            );
        }

        return response()->json([
            'success' => true,
            'balance' => $user->wallet()->first()->balance,
        ]);
    }
}
