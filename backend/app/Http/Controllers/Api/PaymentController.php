<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\Wallet;
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

    public function verify(Request $request, $reference)
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

        $this->creditWallet((int) $metadataUserId, $reference, (float) $payment['amount'] / 100);

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

    public function webhook(Request $request)
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
        $this->creditWallet($userId, $reference, (float) $payment['amount'] / 100);

        return response()->json(['message' => 'Wallet funded.']);
    }

    private function creditWallet(int $userId, string $reference, float $amount): void
    {
        DB::transaction(function () use ($userId, $reference, $amount) {
            $wallet = Wallet::firstOrCreate(
                ['user_id' => $userId],
                ['balance' => 0, 'currency' => 'NGN']
            );

            $wallet->increment('balance', $amount);

            Transaction::create([
                'user_id' => $userId,
                'reference' => $reference,
                'amount' => $amount,
                'status' => 'success',
                'type' => 'deposit',
                'gateway' => 'paystack',
            ]);
        });
    }
}
