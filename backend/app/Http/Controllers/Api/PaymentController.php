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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    /**
     * Fallback used when PAYSTACK_PAYMENT_URL is unset, empty, or missing a scheme.
     */
    private const PAYSTACK_FALLBACK_URL = 'https://api.paystack.co';

    /**
     * Start a Paystack transaction and hand the checkout URL back to the client.
     *
     * Route: POST /api/payment/initialize  (inside auth:sanctum)
     */
    public function initialize(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:100',
        ]);

        $secretKey = trim((string) config('paystack.secret_key'));

        if ($secretKey === '') {
            Log::error('PAYSTACK_INIT_FAILED', ['reason' => 'PAYSTACK_SECRET_KEY is empty']);

            return response()->json([
                'message' => 'Payment is not configured. Please contact support.',
            ], 503);
        }

        $baseUrl = $this->paystackBaseUrl();
        $reference = Str::uuid()->toString();

        try {
            $response = Http::withToken($secretKey)
                ->acceptJson()
                ->asJson()
                ->timeout(20)
                ->post($baseUrl . '/transaction/initialize', [
                    'email' => $request->user()->email,
                    'amount' => (int) round($request->amount * 100),
                    'currency' => 'NGN',
                    'reference' => $reference,
                    'callback_url' => 'https://charpsdev.vercel.app/payment/callback',
                    'metadata' => [
                        'user_id' => $request->user()->id,
                    ],
                ]);
        } catch (\Throwable $e) {
            Log::error('PAYSTACK_INIT_FAILED', [
                'reason' => 'transport',
                'error' => $e->getMessage(),
                'base_url' => $baseUrl,
            ]);

            return response()->json([
                'message' => 'Could not reach Paystack. Please try again.',
            ], 502);
        }

        if ($response->failed()) {
            $message = (string) ($response->json('message') ?: 'Payment could not be started.');

            Log::warning('PAYSTACK_INIT_REJECTED', [
                'status' => $response->status(),
                'message' => $message,
                'reference' => $reference,
            ]);

            return response()->json([
                'message' => $message,
                'reference' => $reference,
            ], 422);
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            Log::error('PAYSTACK_INIT_FAILED', [
                'reason' => 'non-json response',
                'status' => $response->status(),
                'body' => Str::limit((string) $response->body(), 500),
            ]);

            return response()->json([
                'message' => 'Unexpected response from Paystack. Please try again.',
            ], 502);
        }

        // Returned as-is: the client reads `data.authorization_url`.
        return response()->json($payload, 200);
    }

    /**
     * Verify a transaction and credit the wallet.
     *
     * Route: GET /api/payment/verify/{reference}  (inside auth:sanctum)
     */
    public function verify(Request $request, $reference, NotificationService $notifications)
    {
        $secretKey = trim((string) config('paystack.secret_key'));

        if ($secretKey === '') {
            Log::error('PAYSTACK_VERIFY_FAILED', ['reason' => 'PAYSTACK_SECRET_KEY is empty']);

            return response()->json([
                'success' => false,
                'message' => 'Payment is not configured. Please contact support.',
            ], 503);
        }

        try {
            $response = Http::withToken($secretKey)
                ->acceptJson()
                ->timeout(20)
                ->get($this->paystackBaseUrl() . '/transaction/verify/' . rawurlencode((string) $reference));
        } catch (\Throwable $e) {
            Log::error('PAYSTACK_VERIFY_FAILED', [
                'reference' => $reference,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Could not reach Paystack. Please try again.',
            ], 502);
        }

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
            (string) $reference,
            (float) $payment['amount'] / 100,
            $notifications,
            isset($payment['id']) ? (string) $payment['id'] : null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Wallet funded successfully.',
        ]);
    }

    /**
     * Public browser redirect target after Paystack checkout.
     *
     * Route: GET /api/payment/callback  (public)
     */
    public function callback(Request $request)
    {
        // Paystack redirects the browser here after checkout. Keep verification
        // in the authenticated API endpoint; this public route only forwards
        // the reference to the frontend result page.
        $frontendUrl = rtrim((string) (config('cors.allowed_origins.0') ?: config('app.url')), '/');
        $reference = trim((string) $request->query('reference', ''));

        if ($reference === '') {
            return redirect()->away($frontendUrl . '/payment/callback?status=missing_reference');
        }

        return redirect()->away($frontendUrl . '/payment/callback?reference=' . rawurlencode($reference));
    }

    /**
     * Paystack server-to-server webhook.
     *
     * Route: POST /api/payment/webhook  (public, HMAC-verified)
     */
    public function webhook(Request $request, NotificationService $notifications)
    {
        $secretKey = trim((string) config('paystack.secret_key'));

        if ($secretKey === '') {
            Log::error('PAYSTACK_WEBHOOK_FAILED', ['reason' => 'PAYSTACK_SECRET_KEY is empty']);

            return response()->json(['message' => 'Not configured.'], 503);
        }

        $signature = $request->header('x-paystack-signature');
        $computed = hash_hmac('sha512', $request->getContent(), $secretKey);

        if (! hash_equals((string) $computed, (string) $signature)) {
            return response()->json([
                'message' => 'Invalid signature.',
            ], 401);
        }

        if (($request->input('event') ?? '') !== 'charge.success') {
            return response()->json(['message' => 'Ignored']);
        }

        $reference = (string) $request->input('data.reference');

        if ($reference === '') {
            return response()->json(['message' => 'Missing reference.'], 422);
        }

        try {
            $verify = Http::withToken($secretKey)
                ->acceptJson()
                ->timeout(20)
                ->get($this->paystackBaseUrl() . '/transaction/verify/' . rawurlencode($reference));
        } catch (\Throwable $e) {
            Log::error('PAYSTACK_WEBHOOK_FAILED', [
                'reference' => $reference,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Verification failed.'], 502);
        }

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

        if ($userId <= 0) {
            return response()->json(['message' => 'Missing user metadata.'], 422);
        }

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
     * Normalise the configured Paystack base URL so a value without a scheme
     * (e.g. `api.paystack.co`) can never produce an unparseable request URL.
     */
    private function paystackBaseUrl(): string
    {
        $configured = trim((string) config('paystack.payment_url'));

        if ($configured === '') {
            $configured = self::PAYSTACK_FALLBACK_URL;
        }

        if (! Str::startsWith($configured, ['http://', 'https://'])) {
            $configured = 'https://' . ltrim($configured, '/');
        }

        return rtrim($configured, '/');
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

        // Phase 6 (notification triggers): a Paystack deposit previously
        // updated the balance and both ledgers but never told the user it
        // happened. Fired after the transaction commits so a notify failure
        // can never roll back a successful credit.
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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    /**
     * Fallback used when PAYSTACK_PAYMENT_URL is unset, empty, or missing a scheme.
     */
    private const PAYSTACK_FALLBACK_URL = 'https://api.paystack.co';

    /**
     * Start a Paystack transaction and hand the checkout URL back to the client.
     *
     * Route: POST /api/payment/initialize  (inside auth:sanctum)
     */
    public function initialize(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:100',
        ]);

        $secretKey = trim((string) config('paystack.secret_key'));

        if ($secretKey === '') {
            Log::error('PAYSTACK_INIT_FAILED', ['reason' => 'PAYSTACK_SECRET_KEY is empty']);

            return response()->json([
                'message' => 'Payment is not configured. Please contact support.',
            ], 503);
        }

        $baseUrl = $this->paystackBaseUrl();
        $reference = Str::uuid()->toString();

        try {
            $response = Http::withToken($secretKey)
                ->acceptJson()
                ->asJson()
                ->timeout(20)
                ->post($baseUrl . '/transaction/initialize', [
                    'email' => $request->user()->email,
                    'amount' => (int) round($request->amount * 100),
                    'currency' => 'NGN',
                    'reference' => $reference,
                    'callback_url' => 'https://charpsdev.vercel.app/payment/callback',
                    'metadata' => [
                        'user_id' => $request->user()->id,
                    ],
                ]);
        } catch (\Throwable $e) {
            Log::error('PAYSTACK_INIT_FAILED', [
                'reason' => 'transport',
                'error' => $e->getMessage(),
                'base_url' => $baseUrl,
            ]);

            return response()->json([
                'message' => 'Could not reach Paystack. Please try again.',
            ], 502);
        }

        if ($response->failed()) {
            $message = (string) ($response->json('message') ?: 'Payment could not be started.');

            Log::warning('PAYSTACK_INIT_REJECTED', [
                'status' => $response->status(),
                'message' => $message,
                'reference' => $reference,
            ]);

            return response()->json([
                'message' => $message,
                'reference' => $reference,
            ], 422);
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            Log::error('PAYSTACK_INIT_FAILED', [
                'reason' => 'non-json response',
                'status' => $response->status(),
                'body' => Str::limit((string) $response->body(), 500),
            ]);

            return response()->json([
                'message' => 'Unexpected response from Paystack. Please try again.',
            ], 502);
        }

        // Returned as-is: the client reads `data.authorization_url`.
        return response()->json($payload, 200);
    }

    /**
     * Verify a transaction and credit the wallet.
     *
     * Route: GET /api/payment/verify/{reference}  (inside auth:sanctum)
     */
    public function verify(Request $request, $reference, NotificationService $notifications)
    {
        $secretKey = trim((string) config('paystack.secret_key'));

        if ($secretKey === '') {
            Log::error('PAYSTACK_VERIFY_FAILED', ['reason' => 'PAYSTACK_SECRET_KEY is empty']);

            return response()->json([
                'success' => false,
                'message' => 'Payment is not configured. Please contact support.',
            ], 503);
        }

        try {
            $response = Http::withToken($secretKey)
                ->acceptJson()
                ->timeout(20)
                ->get($this->paystackBaseUrl() . '/transaction/verify/' . rawurlencode((string) $reference));
        } catch (\Throwable $e) {
            Log::error('PAYSTACK_VERIFY_FAILED', [
                'reference' => $reference,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Could not reach Paystack. Please try again.',
            ], 502);
        }

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
            (string) $reference,
            (float) $payment['amount'] / 100,
            $notifications,
            isset($payment['id']) ? (string) $payment['id'] : null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Wallet funded successfully.',
        ]);
    }

    /**
     * Public browser redirect target after Paystack checkout.
     *
     * Route: GET /api/payment/callback  (public)
     */
    public function callback(Request $request)
    {
        // Paystack redirects the browser here after checkout. Keep verification
        // in the authenticated API endpoint; this public route only forwards
        // the reference to the frontend result page.
        $frontendUrl = rtrim((string) (config('cors.allowed_origins.0') ?: config('app.url')), '/');
        $reference = trim((string) $request->query('reference', ''));

        if ($reference === '') {
            return redirect()->away($frontendUrl . '/payment/callback?status=missing_reference');
        }

        return redirect()->away($frontendUrl . '/payment/callback?reference=' . rawurlencode($reference));
    }

    /**
     * Paystack server-to-server webhook.
     *
     * Route: POST /api/payment/webhook  (public, HMAC-verified)
     */
    public function webhook(Request $request, NotificationService $notifications)
    {
        $secretKey = trim((string) config('paystack.secret_key'));

        if ($secretKey === '') {
            Log::error('PAYSTACK_WEBHOOK_FAILED', ['reason' => 'PAYSTACK_SECRET_KEY is empty']);

            return response()->json(['message' => 'Not configured.'], 503);
        }

        $signature = $request->header('x-paystack-signature');
        $computed = hash_hmac('sha512', $request->getContent(), $secretKey);

        if (! hash_equals((string) $computed, (string) $signature)) {
            return response()->json([
                'message' => 'Invalid signature.',
            ], 401);
        }

        if (($request->input('event') ?? '') !== 'charge.success') {
            return response()->json(['message' => 'Ignored']);
        }

        $reference = (string) $request->input('data.reference');

        if ($reference === '') {
            return response()->json(['message' => 'Missing reference.'], 422);
        }

        try {
            $verify = Http::withToken($secretKey)
                ->acceptJson()
                ->timeout(20)
                ->get($this->paystackBaseUrl() . '/transaction/verify/' . rawurlencode($reference));
        } catch (\Throwable $e) {
            Log::error('PAYSTACK_WEBHOOK_FAILED', [
                'reference' => $reference,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Verification failed.'], 502);
        }

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

        if ($userId <= 0) {
            return response()->json(['message' => 'Missing user metadata.'], 422);
        }

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
     * Normalise the configured Paystack base URL so a value without a scheme
     * (e.g. `api.paystack.co`) can never produce an unparseable request URL.
     */
    private function paystackBaseUrl(): string
    {
        $configured = trim((string) config('paystack.payment_url'));

        if ($configured === '') {
            $configured = self::PAYSTACK_FALLBACK_URL;
        }

        if (! Str::startsWith($configured, ['http://', 'https://'])) {
            $configured = 'https://' . ltrim($configured, '/');
        }

        return rtrim($configured, '/');
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

        // Phase 6 (notification triggers): a Paystack deposit previously
        // updated the balance and both ledgers but never told the user it
        // happened. Fired after the transaction commits so a notify failure
        // can never roll back a successful credit.
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
