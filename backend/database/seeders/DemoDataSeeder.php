<?php

namespace Database\Seeders;

use App\Models\Order;
use App\Models\Provider;
use App\Models\Service;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a realistic marketplace catalog (providers + services) and a set of
 * demo orders / wallet activity / transactions for the demo accounts created
 * by DatabaseSeeder (admin@example.com / test@example.com), so the frontend
 * dashboard, wallet, orders, and services pages have meaningful data to
 * display out of the box.
 *
 * Safe to run repeatedly: providers/services are upserted by slug, and
 * orders/transactions are only created if the demo users don't already have
 * a reasonable amount of history.
 */
class DemoDataSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $providers = $this->seedProviders();
        $services = $this->seedServices($providers);

        $admin = User::where('email', 'admin@example.com')->first();
        $testUser = User::where('email', 'test@example.com')->first();

        if ($testUser) {
            $this->seedWalletActivity($testUser, startingBalance: 45250.00);
            $this->seedOrders($testUser, $services);
        }

        if ($admin) {
            $this->seedWalletActivity($admin, startingBalance: 128900.00);
            $this->seedOrders($admin, $services, count: 4);
        }
    }

    /**
     * @return array<string, Provider>
     */
    private function seedProviders(): array
    {
        $providers = [
            [
                'name' => 'VTpass',
                'slug' => 'vtpass',
                'base_url' => 'https://sandbox.vtpass.com/api',
                'api_key' => 'demo-vtpass-api-key',
            ],
            [
                'name' => 'Reloadly',
                'slug' => 'reloadly',
                'base_url' => 'https://giftcards-sandbox.reloadly.com',
                'api_key' => 'demo-reloadly-api-key',
            ],
        ];

        $created = [];

        foreach ($providers as $data) {
            $created[$data['slug']] = Provider::updateOrCreate(
                ['slug' => $data['slug']],
                [
                    'name' => $data['name'],
                    'base_url' => $data['base_url'],
                    'api_key' => $data['api_key'],
                    'active' => true,
                ]
            );
        }

        return $created;
    }

    /**
     * @param  array<string, Provider>  $providers
     * @return \Illuminate\Support\Collection<int, Service>
     */
    private function seedServices(array $providers): \Illuminate\Support\Collection
    {
        $catalog = [
            ['name' => 'MTN Airtime Recharge', 'category' => 'vtu', 'price' => 500.00, 'provider' => 'vtpass', 'description' => 'Instant MTN airtime top-up delivered directly to any Nigerian MTN line.'],
            ['name' => 'Glo 5GB Data Bundle', 'category' => 'vtu', 'price' => 1500.00, 'provider' => 'vtpass', 'description' => '30-day 5GB data bundle for Glo subscribers, activated instantly after purchase.'],
            ['name' => 'Airtel Airtime Recharge', 'category' => 'vtu', 'price' => 1000.00, 'provider' => 'vtpass', 'description' => 'Top up any Airtel Nigeria number instantly, any amount from ₦100 upward.'],
            ['name' => '9mobile 2GB Data Bundle', 'category' => 'vtu', 'price' => 1200.00, 'provider' => 'vtpass', 'description' => '30-day 2GB data plan for 9mobile lines with instant activation.'],
            ['name' => 'Amazon Gift Card - $50', 'category' => 'giftcard', 'price' => 78000.00, 'provider' => 'reloadly', 'description' => 'Digital $50 Amazon.com gift card delivered via email code, redeemable instantly.'],
            ['name' => 'iTunes Gift Card - $25', 'category' => 'giftcard', 'price' => 39500.00, 'provider' => 'reloadly', 'description' => '$25 iTunes/Apple gift card code for the US App Store, delivered digitally.'],
            ['name' => 'Steam Wallet Gift Card - $20', 'category' => 'giftcard', 'price' => 31800.00, 'provider' => 'reloadly', 'description' => '$20 Steam wallet code, redeemable on any Steam account worldwide.'],
            ['name' => 'Travel eSIM - USA 5GB / 7 Days', 'category' => 'esim', 'price' => 12500.00, 'provider' => 'reloadly', 'description' => 'Prepaid data-only eSIM for the United States, 5GB valid for 7 days, QR delivery.'],
            ['name' => 'Travel eSIM - Europe 10GB / 30 Days', 'category' => 'esim', 'price' => 18900.00, 'provider' => 'reloadly', 'description' => 'Pan-European data-only eSIM covering 30+ countries, 10GB valid for 30 days.'],
            ['name' => 'BVN Verification', 'category' => 'verification', 'price' => 2000.00, 'provider' => null, 'description' => 'Verify a Bank Verification Number and retrieve masked KYC details instantly.'],
            ['name' => 'NIN Verification (Slip)', 'category' => 'verification', 'price' => 1500.00, 'provider' => null, 'description' => 'Retrieve and verify a National Identification Number with a printable slip.'],
            ['name' => 'Netflix Premium - 1 Month', 'category' => 'digital', 'price' => 4500.00, 'provider' => null, 'description' => 'Shared Netflix Premium 4K subscription slot, valid for 30 days.'],
            ['name' => 'Spotify Premium - 1 Month', 'category' => 'digital', 'price' => 2500.00, 'provider' => null, 'description' => 'Individual Spotify Premium subscription code, activates on any account.'],
            ['name' => 'DSTV Compact Subscription', 'category' => 'utility', 'price' => 19000.00, 'provider' => null, 'description' => 'Monthly DSTV Compact bouquet renewal, applied directly to your smartcard number.'],
            ['name' => 'EKEDC Electricity Bill Payment', 'category' => 'utility', 'price' => 10000.00, 'provider' => null, 'description' => 'Prepaid electricity token purchase for Eko Electricity Distribution Company meters.'],
        ];

        $services = collect();

        foreach ($catalog as $item) {
            $slug = Str::slug($item['name']);

            $service = Service::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $item['name'],
                    'category' => $item['category'],
                    'description' => $item['description'],
                    'price' => $item['price'],
                    'active' => true,
                    'provider_id' => $item['provider'] ? ($providers[$item['provider']]->id ?? null) : null,
                ]
            );

            $services->push($service);
        }

        return $services;
    }

    private function seedWalletActivity(User $user, float $startingBalance): void
    {
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'currency' => 'NGN']
        );

        // Only seed activity if this wallet looks untouched (avoid duplicating on re-run).
        if (WalletTransaction::where('wallet_id', $wallet->id)->exists()) {
            return;
        }

        $entries = [
            ['type' => 'credit', 'amount' => 25000.00, 'description' => 'Wallet funding via Paystack', 'status' => 'success', 'daysAgo' => 21],
            ['type' => 'credit', 'amount' => 40000.00, 'description' => 'Wallet funding via Paystack', 'status' => 'success', 'daysAgo' => 14],
            ['type' => 'debit', 'amount' => 4500.00, 'description' => 'Purchase: Netflix Premium - 1 Month', 'status' => 'success', 'daysAgo' => 12],
            ['type' => 'debit', 'amount' => 1500.00, 'description' => 'Purchase: Glo 5GB Data Bundle', 'status' => 'success', 'daysAgo' => 9],
            ['type' => 'credit', 'amount' => 15000.00, 'description' => 'Wallet funding via Paystack', 'status' => 'success', 'daysAgo' => 6],
            ['type' => 'debit', 'amount' => 2000.00, 'description' => 'Purchase: BVN Verification', 'status' => 'success', 'daysAgo' => 4],
            ['type' => 'debit', 'amount' => 1000.00, 'description' => 'Purchase: Airtel Airtime Recharge', 'status' => 'pending', 'daysAgo' => 1],
        ];

        $runningBalance = 0.0;

        foreach ($entries as $entry) {
            $reference = 'demo_' . Str::uuid();
            $createdAt = now()->subDays($entry['daysAgo']);

            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => $entry['type'],
                'amount' => $entry['amount'],
                'reference' => $reference,
                'description' => $entry['description'],
                'status' => $entry['status'],
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            Transaction::create([
                'user_id' => $user->id,
                'reference' => $reference,
                'amount' => $entry['amount'],
                'status' => $entry['status'],
                'type' => $entry['type'] === 'credit' ? 'deposit' : 'purchase',
                'gateway' => $entry['type'] === 'credit' ? 'paystack' : null,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            if ($entry['status'] === 'success') {
                $runningBalance += $entry['type'] === 'credit' ? $entry['amount'] : -$entry['amount'];
            }
        }

        $wallet->update(['balance' => max($runningBalance, 0)]);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Service>  $services
     */
    private function seedOrders(User $user, \Illuminate\Support\Collection $services, int $count = 5): void
    {
        if (Order::where('user_id', $user->id)->exists()) {
            return;
        }

        $statuses = ['completed', 'completed', 'processing', 'pending', 'failed'];
        $picks = $services->random(min($count, $services->count()));

        $i = 0;
        foreach ($picks as $service) {
            $status = $statuses[$i % count($statuses)];
            $createdAt = now()->subDays(rand(1, 20));

            Order::create([
                'user_id' => $user->id,
                'service_id' => $service->id,
                'reference' => 'ORD-' . strtoupper(Str::random(10)),
                'amount' => $service->price,
                'payload' => ['note' => 'Demo seeded order'],
                'provider_reference' => $status === 'completed' ? 'PRV-' . strtoupper(Str::random(8)) : null,
                'status' => $status,
                'details' => ['service_name' => $service->name],
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $i++;
        }
    }
}
