<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function initialize(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:100',
        ]);

        $response = Http::withToken(config('paystack.secret_key'))
            ->post(config('paystack.payment_url') . '/transaction/initialize', [
                'email' => $request->user()->email,
                'amount' => (int) round($request->amount * 100),
                'currency' => 'NGN',
                'reference' => Str::uuid()->toString(),
                'callback_url' => config('app.url') . '/api/payment/callback',
                'metadata' => [
                    'user_id' => $request->user()->id,
                ],
            ]);

        return response()->json($response->json(), $response->status());
    }

    public function verify(Request $request, $reference, NotificationService $notifications)
    {
        $response = Http::withToken(config('paystack.secret_key'))
            ->get(config('paystack.payment_url') . "/transaction/verify/{$reference}");

        if (! $response->successful()) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to verify payment.',
                'error' => $response->json(),
            ], 400);
        }

        $payment = $response->json('data', []);

        if (($payment['status'] ?? null) !== 'success') {
            return response()->json([
                'success' => false,
                'message' => 'Payment not successful.',
            ], 422);
        }

        $metadataUserId = data_get($payment, 'metadata.user_id');
        if ((int) $metadataUserId !== (int) $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Payment does not belong to the authenticated user.',
            ], 403);
        }

        if (Transaction::where('reference', $reference)->exists()) {
            return response()->json([
                'success' => true,
                'message' => 'Payment already processed.',
            ]);
        }

        $this->creditWallet(
            (int) $metadataUserId,
            $reference,
            (float) $payment['amount'] / 100,
            $notifications,
            isset($payment['id']) ? (string) $payment['id'] : null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Wallet funded successfully.',
        ]);
    }

    public function callback(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Payment completed. Verifying transaction...',
        ]);
    }

    public function webhook(Request $request, NotificationService $notifications)
    {
        $signature = $request->header('x-paystack-signature');
        $computed = hash_hmac('sha512', $request->getContent(), config('paystack.secret_key'));

        if (! hash_equals((string) $computed, (string) $signature)) {
            return response()->json([
                'message' => 'Invalid signature.',
            ], 401);
        }

        if (($request->input('event') ?? '') !== 'charge.success') {
            return response()->json(['message' => 'Ignored']);
        }

        $reference = (string) $request->input('data.reference');
        $verify = Http::withToken(config('paystack.secret_key'))
            ->get(config('paystack.payment_url') . '/transaction/verify/' . $reference);

        if (! $verify->successful()) {
            return response()->json(['message' => 'Verification failed.'], 400);
        }

        $payment = $verify->json('data', []);

        if (($payment['status'] ?? null) !== 'success') {
            return response()->json(['message' => 'Payment not successful.'], 422);
        }

        if (Transaction::where('reference', $reference)->exists()) {
            return response()->json(['message' => 'Already processed.']);
        }

        $userId = (int) data_get($payment, 'metadata.user_id');
        $this->creditWallet(
            $userId,
            $reference,
            (float) $payment['amount'] / 100,
            $notifications,
            isset($payment['id']) ? (string) $payment['id'] : null,
        );

        return response()->json(['message' => 'Wallet funded.']);
    }

    /**
     * Phase 2 (Wallet Refinements): previously this only wrote to
     * `transactions`. `wallet_transactions` (the strict credit/debit ledger
     * also used by checkout and admin credit/debit) never recorded Paystack
     * deposits, so it was an incomplete audit trail for anyone reconciling
     * wallet balance movements from that table alone. Now both tables are
     * written on every deposit, matching the pattern already used by
     * CheckoutController and AdminWalletController.
     */
    private function creditWallet(int $userId, string $reference, float $amount, NotificationService $notifications, ?string $gatewayReference = null): void
    {
        DB::transaction(function () use ($userId, $reference, $amount, $gatewayReference) {
            $wallet = Wallet::query()->where('user_id', $userId)->lockForUpdate()->first();
            $wallet ??= Wallet::create(['user_id' => $userId, 'balance' => 0, 'currency' => 'NGN']);

            $wallet->increment('balance', $amount);

            $description = 'Wallet funded via Paystack';

            Transaction::create([
                'user_id' => $userId,
                'reference' => $reference,
                'amount' => $amount,
                'currency' => $wallet->currency ?? 'NGN',
                'status' => 'success',
                'type' => 'deposit',
                'gateway' => 'paystack',
                'gateway_reference' => $gatewayReference,
                'description' => $description,
            ]);

            $wallet->transactions()->create([
                'wallet_id' => $wallet->id,
                'user_id' => $userId,
                'type' => 'credit',
                'amount' => $amount,
                'reference' => $reference,
                'description' => $description,
                'status' => 'success',
            ]);
        });

        // Phase 6 (more notification triggers): a Paystack deposit previously
        // updated the balance and both ledgers but never told the user it
        // happened - notified only implicitly by them noticing a new balance
        // next time they opened the Wallet page. Fired after the transaction
        // commits so a notify failure can never roll back a successful credit.
        if ($user = User::find($userId)) {
            $notifications->notify(
                $user,
                'wallet',
                'Wallet funded',
                'Your wallet was funded with ' . number_format($amount, 2) . ' NGN via Paystack.',
                '/wallet',
            );
        }
    }
}
