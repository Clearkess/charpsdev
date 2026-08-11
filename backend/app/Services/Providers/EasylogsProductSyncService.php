<?php

namespace App\Services\Providers;

use App\Models\Category;
use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Provider Router (Option B) — Easylogs product catalogue importer.
 *
 * Adapted from a user-supplied installer script that fetched Easylogs'
 * `/categories` + `/products` and upserted plain `services` rows keyed by a
 * NEW `services.provider_product_code` column. That approach left every
 * synced product unroutable: `ProviderRouter` only ever reads a service's
 * `service_provider_routes` chain (see ProviderRouter::routableRoutes()),
 * never a column on `services` itself, so an admin would have had to open
 * the routing editor and manually add a route for every single imported
 * product before it could actually be fulfilled.
 *
 * This version fixes that by treating the sync as "create/update a Service
 * AND its service_provider_routes entry" as one atomic unit — a product
 * that comes back from this sync is immediately routable through the
 * existing Provider Router, with zero manual follow-up and zero new
 * migration (no `provider_product_code` column: `service_provider_routes.
 * provider_service_id`, which already exists from Option A, is the sole
 * source of truth for "this service's code on this provider").
 *
 * Matching key for "already imported vs. new": (provider_id,
 * provider_service_id) on `service_provider_routes` — NOT the service's
 * name/slug, which an admin might edit locally without wanting a re-sync to
 * treat it as a different product.
 */
class EasylogsProductSyncService
{
    /**
     * Legacy `services.category` enum values this codebase already
     * recognizes (see Admin\ServiceController::LEGACY_CATEGORY_VALUES) — a
     * synced Easylogs category slug is matched against these so the
     * NOT-NULL legacy column still gets a sensible value without adding a
     * new one of its own.
     */
    private const LEGACY_CATEGORY_VALUES = [
        'vtu', 'giftcard', 'esim', 'verification', 'digital', 'utility', 'social', 'email', 'streaming',
    ];

    /**
     * @return array{
     *     currency: string, markup_percent: float,
     *     created: int, updated: int, skipped: int,
     *     remote_categories: int, remote_products: int,
     * }
     */
    public function sync(Provider $provider, string $currency = 'NGN', float $markupPercent = 20): array
    {
        if ($provider->slug !== 'easylogs') {
            throw new RuntimeException('This provider is not the Easylogs Marketplace provider (slug must be exactly "easylogs").');
        }

        if (! $provider->active) {
            throw new RuntimeException('Easylogs provider is inactive.');
        }

        if (blank($provider->api_key)) {
            throw new RuntimeException('Easylogs API key is not configured.');
        }

        $baseUrl = rtrim($provider->base_url, '/');
        $currency = strtoupper($currency);
        $headers = ['Accept' => 'application/json', 'Authorization' => 'Bearer '.$provider->api_key];

        $categories = $this->listFrom($this->get($baseUrl.'/categories', $headers));
        $products = $this->listFrom($this->get($baseUrl.'/products', $headers, ['currency' => $currency]));

        $categoryMap = [];
        foreach ($categories as $remoteCategory) {
            $remoteId = $remoteCategory['id'] ?? $remoteCategory['category_id'] ?? null;
            $name = trim((string) ($remoteCategory['name'] ?? $remoteCategory['category_name'] ?? ''));

            if ($remoteId === null || $name === '') {
                continue;
            }

            $category = Category::firstOrCreate(
                ['slug' => Str::slug('easylogs-'.$remoteId.'-'.$name)],
                ['name' => $name, 'status' => true, 'sort_order' => 900],
            );

            $categoryMap[(string) $remoteId] = $category;
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;

        DB::transaction(function () use ($products, $provider, $currency, $markupPercent, $categoryMap, &$created, &$updated, &$skipped) {
            foreach ($products as $remoteProduct) {
                $code = trim((string) ($remoteProduct['product_code'] ?? $remoteProduct['code'] ?? ''));
                $name = trim((string) ($remoteProduct['product_name'] ?? $remoteProduct['name'] ?? ''));
                $amount = $remoteProduct['amount'] ?? $remoteProduct['price'] ?? $remoteProduct['selling_price'] ?? null;

                if ($code === '' || $name === '' || ! is_numeric($amount)) {
                    $skipped++;

                    continue;
                }

                $category = null;
                $remoteCategoryId = $remoteProduct['category_id'] ?? $remoteProduct['category'] ?? null;

                if ($remoteCategoryId !== null) {
                    $category = $categoryMap[(string) $remoteCategoryId] ?? null;
                }

                if (! $category && ! empty($remoteProduct['category_name'])) {
                    $category = Category::firstOrCreate(
                        ['slug' => Str::slug('easylogs-'.$remoteProduct['category_name'])],
                        ['name' => trim($remoteProduct['category_name']), 'status' => true, 'sort_order' => 900],
                    );
                }

                $rawCost = (float) $amount;
                $sellingPrice = round($rawCost * (1 + $markupPercent / 100), 2);

                $servicePayload = [
                    'name' => $name,
                    'description' => $remoteProduct['description'] ?? null,
                    'price' => $sellingPrice,
                    'currency' => $currency,
                    'active' => true,
                    'category' => $category ? $this->legacyCategoryFor($category->slug) : 'digital',
                ];

                if ($category) {
                    $servicePayload['category_id'] = $category->id;
                }

                // Match on the ROUTE, never on the service's own
                // name/slug — see class doc comment.
                $route = ServiceProviderRoute::where('provider_id', $provider->id)
                    ->where('provider_service_id', $code)
                    ->first();

                if ($route && $route->service) {
                    $route->service->update($servicePayload);
                    $route->update(['provider_cost' => $rawCost]);
                    $updated++;

                    continue;
                }

                $slug = Str::slug($name);
                if (Service::where('slug', $slug)->exists()) {
                    $slug .= '-'.Str::lower(Str::random(6));
                }
                $servicePayload['slug'] = $slug;
                $servicePayload['provider_id'] = $provider->id;

                $service = Service::create($servicePayload);

                // Brand-new service from this sync — no prior routes exist,
                // so priority 1 makes this Easylogs route the primary,
                // immediately-routable chain entry with no manual step.
                if ($route) {
                    // Orphaned route (its service was deleted separately) —
                    // reuse it rather than violate the unique(service_id,
                    // provider_id) constraint with a duplicate.
                    $route->update(['service_id' => $service->id, 'priority' => 1, 'enabled' => true, 'provider_cost' => $rawCost]);
                } else {
                    ServiceProviderRoute::create([
                        'service_id' => $service->id,
                        'provider_id' => $provider->id,
                        'priority' => 1,
                        'enabled' => true,
                        'provider_service_id' => $code,
                        'provider_cost' => $rawCost,
                    ]);
                }

                $created++;
            }
        });

        return [
            'currency' => $currency,
            'markup_percent' => $markupPercent,
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'remote_categories' => count($categories),
            'remote_products' => count($products),
        ];
    }

    private function get(string $url, array $headers, array $query = []): array
    {
        $response = Http::withHeaders($headers)->timeout(30)->retry(2, 500, throw: false)->get($url, $query);
        $data = $response->json();

        if (! $response->successful() || ! is_array($data)) {
            throw new RuntimeException((string) ($data['message'] ?? $data['error'] ?? 'Easylogs API request failed.'));
        }

        return $data;
    }

    private function listFrom(array $response): array
    {
        $list = $response['data'] ?? $response['categories'] ?? $response['products'] ?? [];

        return is_array($list) && array_is_list($list) ? $list : [];
    }

    private function legacyCategoryFor(string $slug): string
    {
        foreach (self::LEGACY_CATEGORY_VALUES as $value) {
            if (str_contains($slug, $value)) {
                return $value;
            }
        }

        return 'digital';
    }
}
