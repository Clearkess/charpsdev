<?php

namespace App\Services;

use App\Models\Provider;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\VirtualNumberOrder;
use App\Models\Wallet;
use App\Services\SmsProviders\FiveSimProvider;
use App\Services\SmsProviders\OnlineSimProvider;
use App\Services\SmsProviders\SmsManProvider;
use App\Services\SmsProviders\SmsProviderException;
use App\Services\SmsProviders\SmsProviderInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Orchestrates the virtual-number/SMS-OTP rental feature (Phase 7,
 * Provider API Sync) across the three supported providers. Mirrors
 * CheckoutController's wallet-debit transaction pattern, but the actual
 * provider purchase call happens OUTSIDE the DB transaction that locks
 * the wallet row: 5SIM/SMS-Man/OnlineSIM are slow, occasionally-flaky
 * third-party HTTP calls, and holding a row lock on the wallet for the
 * duration of one would block every other operation on that wallet (and
 * risk a lock-wait timeout) for no benefit. Instead: reserve funds in a
 * short transaction, call the provider, then either finalize the
 * already-created order or refund in a second short transaction.
 */
class VirtualNumberService
{
    /**
     * Providers this feature knows how to build an adapter for. Keyed by
     * `providers.slug` — the 3 real credentialed rows are expected to be
     * created (via the existing Admin Provider CRUD, never a seeder) with
     * exactly these slugs.
     */
    private const ADAPTERS = [
        '5sim' => FiveSimProvider::class,
        'sms-man' => SmsManProvider::class,
        'onlinesim' => OnlineSimProvider::class,
    ];

    public static function supportedSlugs(): array
    {
        return array_keys(self::ADAPTERS);
    }

    /**
     * Active providers configured for this feature, in the shape the
     * frontend's "pick a provider tab" UI needs. Order is fixed (not
     * alphabetical) so the two live-verified providers lead.
     */
    public function activeProviders(): array
    {
        $order = ['5sim', 'onlinesim', 'sms-man'];

        $providers = Provider::whereIn('slug', self::supportedSlugs())
            ->where('active', true)
            ->get()
            ->keyBy('slug');

        $result = [];
        foreach ($order as $slug) {
            if ($providers->has($slug)) {
                $provider = $providers[$slug];
                $result[] = [
                    'id' => $provider->id,
                    'slug' => $provider->slug,
                    'name' => $provider->name,
                ];
            }
        }

        return $result;
    }

    public function resolveProvider(string $slug): SmsProviderInterface
    {
        if (! isset(self::ADAPTERS[$slug])) {
            throw ValidationException::withMessages(['provider' => "Unknown provider \"{$slug}\"."]);
        }

        $provider = Provider::where('slug', $slug)->where('active', true)->first();

        if (! $provider || blank($provider->api_key)) {
            throw ValidationException::withMessages(['provider' => "\"{$slug}\" is not configured yet. Please contact support."]);
        }

        $adapterClass = self::ADAPTERS[$slug];

        return blank($provider->base_url)
            ? new $adapterClass($provider->api_key)
            : new $adapterClass($provider->api_key, rtrim($provider->base_url, '/'));
    }

    public function listCountries(string $slug): array
    {
        return $this->resolveProvider($slug)->listCountries();
    }

    public function listServices(string $slug, string $country): array
    {
        return $this->resolveProvider($slug)->listServices($country);
    }

    /** USD -> NGN, marked up. Both factors are snapshotted onto the order. */
    private function priceNgn(float $costUsd, float $markupPercent, float $rate): float
    {
        return round($costUsd * (1 + $markupPercent / 100) * $rate, 2);
    }

    /**
     * Buys a virtual number for $user against provider $slug, debiting
     * their wallet at the live provider price (re-fetched here, not
     * trusted from the client) plus markup, converted to NGN.
     *
     * @throws ValidationException on insufficient balance, unknown
     *   service, or a provider-side purchase failure (balance is
     *   refunded automatically in the latter case).
     */
    public function buyNumber(User $user, string $slug, string $country, string $serviceCode): VirtualNumberOrder
    {
        $provider = $this->resolveProvider($slug);

        $services = $provider->listServices($country);
        $service = collect($services)->firstWhere('code', $serviceCode);

        if (! $service) {
            throw ValidationException::withMessages(['service' => 'That service is no longer available for this country. Please refresh and try again.']);
        }

        $costUsd = (float) $service['cost_usd'];
        $markupPercent = (float) Setting::get('virtual_number_markup_percent', 20);
        $rate = (float) Setting::get('usd_to_ngn_rate', 1600);
        $priceNgn = $this->priceNgn($costUsd, $markupPercent, $rate);
        $reference = 'VN-' . Str::upper(Str::random(10));

        $providerRow = Provider::where('slug', $slug)->first();

        $order = DB::transaction(function () use ($user, $slug, $providerRow, $country, $serviceCode, $service, $costUsd, $markupPercent, $rate, $priceNgn, $reference) {
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();
            $wallet ??= Wallet::create(['user_id' => $user->id, 'balance' => 0, 'currency' => 'NGN']);

            if ((float) $wallet->balance < $priceNgn) {
                throw ValidationException::withMessages([
                    'wallet' => 'Insufficient wallet balance. Please fund your wallet and try again.',
                ]);
            }

            $wallet->decrement('balance', $priceNgn);

            $wallet->transactions()->create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => 'debit',
                'amount' => $priceNgn,
                'reference' => $reference,
                'description' => "Virtual number: {$service['name']} ({$slug})",
                'status' => 'success',
            ]);

            Transaction::create([
                'user_id' => $user->id,
                'reference' => $reference,
                'amount' => $priceNgn,
                'status' => 'success',
                'type' => 'virtual_number',
                'gateway' => 'wallet',
                'description' => "Virtual number: {$service['name']} ({$slug})",
            ]);

            return VirtualNumberOrder::create([
                'user_id' => $user->id,
                'provider_id' => $providerRow?->id,
                'provider_slug' => $slug,
                'external_id' => 'pending-' . $reference,
                'country' => $country,
                'service_code' => $serviceCode,
                'service_name' => $service['name'],
                'cost_usd' => $costUsd,
                'exchange_rate' => $rate,
                'markup_percent' => $markupPercent,
                'price_ngn' => $priceNgn,
                'currency' => 'NGN',
                'status' => 'pending',
                'reference' => $reference,
            ]);
        });

        try {
            $result = $provider->buyNumber($country, $serviceCode);
        } catch (SmsProviderException $e) {
            $this->refund($order, "purchase failed: {$e->getMessage()}");

            throw ValidationException::withMessages([
                'provider' => "Could not rent a number right now ({$e->getMessage()}). You have been refunded.",
            ]);
        }

        $order->update([
            'external_id' => $result['external_id'],
            'phone_number' => $result['phone_number'],
            'operator' => $result['operator'],
            'status' => 'waiting_code',
            'expires_at' => $result['expires_at'] ? now()->parse($result['expires_at']) : now()->addMinutes(15),
            'meta' => ['buy' => $result['raw']],
        ]);

        return $order->fresh();
    }

    /**
     * Credits the customer's wallet back for a failed/cancelled/expired
     * order and marks it `refunded`. Runs in its own short transaction
     * with a fresh wallet lock (separate from the debit transaction,
     * which has already committed by the time this can be called).
     */
    public function refund(VirtualNumberOrder $order, string $reason): VirtualNumberOrder
    {
        if ($order->status === 'refunded') {
            return $order;
        }

        DB::transaction(function () use ($order, $reason) {
            $wallet = Wallet::where('user_id', $order->user_id)->lockForUpdate()->first();

            if ($wallet) {
                $wallet->increment('balance', $order->price_ngn);

                $wallet->transactions()->create([
                    'wallet_id' => $wallet->id,
                    'user_id' => $order->user_id,
                    'type' => 'credit',
                    'amount' => $order->price_ngn,
                    'reference' => $order->reference . '-REFUND',
                    'description' => "Refund: virtual number {$order->reference} ({$reason})",
                    'status' => 'success',
                ]);

                Transaction::create([
                    'user_id' => $order->user_id,
                    'reference' => $order->reference . '-REFUND',
                    'amount' => $order->price_ngn,
                    'status' => 'success',
                    'type' => 'refund',
                    'gateway' => 'wallet',
                    'description' => "Refund: virtual number {$order->reference} ({$reason})",
                ]);
            } else {
                Log::error('VirtualNumberService::refund - no wallet found', ['order_id' => $order->id]);
            }

            $order->update([
                'status' => 'refunded',
                'cancelled_at' => now(),
                'meta' => array_merge($order->meta ?? [], ['refund_reason' => $reason]),
            ]);
        });

        return $order->fresh();
    }

    /**
     * Polls the provider for this order's current state. Auto-refunds on
     * any terminal failure (cancelled/expired/failed on the provider's
     * side) since the customer never received a usable code — matches
     * the same "no value delivered, no charge" principle as the
     * insufficient-stock/failed-purchase paths elsewhere in the app.
     */
    public function pollStatus(VirtualNumberOrder $order): VirtualNumberOrder
    {
        if (! $order->isActive()) {
            return $order;
        }

        $provider = $this->resolveProvider($order->provider_slug);

        try {
            $result = $provider->checkStatus($order->external_id);
        } catch (SmsProviderException $e) {
            Log::warning('VirtualNumberService::pollStatus check failed', ['order_id' => $order->id, 'message' => $e->getMessage()]);

            return $order;
        }

        if ($result['status'] === 'waiting') {
            return $order;
        }

        if ($result['status'] === 'received') {
            $order->update([
                'status' => 'received',
                'sms_code' => $result['sms_code'],
                'sms_text' => $result['sms_text'],
                'completed_at' => now(),
                'meta' => array_merge($order->meta ?? [], ['check' => $result['raw']]),
            ]);

            // Best-effort: tell the provider we're done so it can release
            // the number back to its own pool. Never fatal to our side.
            $provider->finish($order->external_id);

            return $order->fresh();
        }

        // cancelled / expired / failed: no code was ever delivered.
        return $this->refund($order, "provider status: {$result['status']}");
    }

    /**
     * User-initiated cancel (e.g. gave up waiting for the code). Best
     * effort on the provider's side, then always refunds — the customer
     * decided not to use the number, and 5SIM/OnlineSIM's own "cancel"
     * endpoints are specifically meant for this before an SMS arrives.
     */
    public function cancelOrder(VirtualNumberOrder $order): VirtualNumberOrder
    {
        if (! $order->isActive()) {
            return $order;
        }

        try {
            $this->resolveProvider($order->provider_slug)->cancel($order->external_id);
        } catch (\Throwable $e) {
            Log::warning('VirtualNumberService::cancelOrder provider cancel failed', ['order_id' => $order->id, 'message' => $e->getMessage()]);
        }

        return $this->refund($order, 'cancelled by customer');
    }
}
