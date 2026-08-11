<?php

namespace Tests\Feature\Providers;

use App\Models\Category;
use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use App\Models\User;
use App\Services\Providers\EasylogsProductSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Provider Router (Option B) — EasylogsProductSyncService coverage.
 *
 * The core behaviour under test (and the whole reason this sync exists in
 * this shape rather than the user-supplied installer script's original
 * shape): a synced product must come out immediately ROUTABLE through the
 * existing Provider Router — i.e. it must have a service_provider_routes
 * row with provider_service_id = the real Easylogs product_code — not just
 * a bare Service row with nowhere for ProviderRouter to actually send an
 * order.
 */
class EasylogsProductSyncTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function makeEasylogsProvider(): Provider
    {
        return Provider::create([
            'name' => 'Easylogs Marketplace',
            'slug' => 'easylogs',
            'base_url' => 'https://easylogs.test/api',
            'api_key' => 'real-token',
            'active' => true,
            'category' => 'digital',
            'health_status' => Provider::HEALTH_HEALTHY,
        ]);
    }

    private function fakeCatalogue(): void
    {
        Http::fake([
            'easylogs.test/api/categories*' => Http::response([
                'data' => [
                    ['id' => 10, 'name' => 'Streaming'],
                ],
            ], 200),
            'easylogs.test/api/products*' => Http::response([
                'data' => [
                    [
                        'product_code' => 'PROD-NETFLIX-1M',
                        'product_name' => 'Netflix Premium 1 Month',
                        'amount' => 1000,
                        'category_id' => 10,
                        'description' => 'One month Netflix Premium.',
                    ],
                ],
            ], 200),
        ]);
    }

    public function test_sync_creates_a_service_with_a_routable_route_and_real_product_code(): void
    {
        $this->fakeCatalogue();
        $provider = $this->makeEasylogsProvider();

        $result = app(EasylogsProductSyncService::class)->sync($provider, 'NGN', 20);

        $this->assertSame(1, $result['created']);
        $this->assertSame(0, $result['updated']);
        $this->assertSame(0, $result['skipped']);

        $service = Service::where('name', 'Netflix Premium 1 Month')->first();
        $this->assertNotNull($service);
        // 1000 + 20% markup = 1200.00
        $this->assertSame('1200.00', (string) $service->price);
        $this->assertSame($provider->id, $service->provider_id);

        $category = Category::where('name', 'Streaming')->first();
        $this->assertNotNull($category);
        $this->assertSame($category->id, $service->category_id);

        // The critical fix over the original script: a route must exist,
        // and its provider_service_id must be the REAL Easylogs code —
        // never invented — so ProviderRouter can actually fulfil it.
        $route = ServiceProviderRoute::where('service_id', $service->id)
            ->where('provider_id', $provider->id)
            ->first();
        $this->assertNotNull($route);
        $this->assertSame('PROD-NETFLIX-1M', $route->provider_service_id);
        $this->assertTrue($route->enabled);
        $this->assertSame(1, $route->priority);
        $this->assertSame('1000.0000', (string) $route->provider_cost);
    }

    public function test_sync_is_idempotent_and_updates_on_second_run(): void
    {
        // Http::fake() calls made within the same test MERGE rather than
        // replace stub callbacks (Laravel's PendingRequest::stub()), and
        // the FIRST-registered URL-pattern match wins — so a second
        // Http::fake([...]) call here would be silently ignored in favour
        // of the first. Use one fake with a request-counter closure
        // instead, so the second sync() call genuinely sees a changed
        // upstream response.
        $callCount = 0;
        Http::fake(function ($request) use (&$callCount) {
            if (str_contains($request->url(), '/categories')) {
                return Http::response(['data' => [['id' => 10, 'name' => 'Streaming']]], 200);
            }

            $callCount++;
            $amount = $callCount === 1 ? 1000 : 1100;
            $name = $callCount === 1 ? 'Netflix Premium 1 Month' : 'Netflix Premium 1 Month (Updated)';

            return Http::response([
                'data' => [[
                    'product_code' => 'PROD-NETFLIX-1M',
                    'product_name' => $name,
                    'amount' => $amount,
                    'category_id' => 10,
                ]],
            ], 200);
        });

        $provider = $this->makeEasylogsProvider();

        app(EasylogsProductSyncService::class)->sync($provider, 'NGN', 20);

        $result = app(EasylogsProductSyncService::class)->sync($provider->fresh(), 'NGN', 20);

        $this->assertSame(0, $result['created']);
        $this->assertSame(1, $result['updated']);
        $this->assertSame(1, Service::count());

        $service = Service::first();
        $this->assertSame('Netflix Premium 1 Month (Updated)', $service->name);
        // 1100 + 20% = 1320.00
        $this->assertSame('1320.00', (string) $service->price);

        // Still exactly one route for this service+provider pair — no
        // duplicate route was created on the update path.
        $this->assertSame(1, ServiceProviderRoute::where('service_id', $service->id)->count());
        $route = ServiceProviderRoute::first();
        $this->assertSame('1100.0000', (string) $route->provider_cost);
    }

    public function test_sync_skips_products_missing_code_name_or_amount(): void
    {
        Http::fake([
            'easylogs.test/api/categories*' => Http::response(['data' => []], 200),
            'easylogs.test/api/products*' => Http::response([
                'data' => [
                    ['product_code' => '', 'product_name' => 'Bad Code', 'amount' => 500],
                    ['product_code' => 'OK-1', 'product_name' => '', 'amount' => 500],
                    ['product_code' => 'OK-2', 'product_name' => 'Bad Amount', 'amount' => 'not-a-number'],
                    ['product_code' => 'OK-3', 'product_name' => 'Valid Product', 'amount' => 250],
                ],
            ], 200),
        ]);
        $provider = $this->makeEasylogsProvider();

        $result = app(EasylogsProductSyncService::class)->sync($provider, 'NGN', 10);

        $this->assertSame(1, $result['created']);
        $this->assertSame(3, $result['skipped']);
        $this->assertSame('Valid Product', Service::first()->name);
    }

    public function test_sync_rejects_non_easylogs_provider(): void
    {
        $provider = Provider::create([
            'name' => 'Some Other Provider',
            'slug' => 'vtpass-'.Str::random(6),
            'base_url' => 'https://example.test/api',
            'api_key' => 'token',
            'active' => true,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('not the Easylogs Marketplace provider');

        app(EasylogsProductSyncService::class)->sync($provider);
    }

    public function test_sync_rejects_inactive_provider(): void
    {
        $provider = $this->makeEasylogsProvider();
        $provider->update(['active' => false]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('inactive');

        app(EasylogsProductSyncService::class)->sync($provider);
    }

    public function test_sync_rejects_provider_with_no_api_key(): void
    {
        // providers.api_key is NOT NULL (text column) — the "no key set"
        // state in this codebase is an empty string, not null (see also
        // ProviderController's blank() checks elsewhere).
        $provider = $this->makeEasylogsProvider();
        $provider->update(['api_key' => '']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('API key is not configured');

        app(EasylogsProductSyncService::class)->sync($provider);
    }

    public function test_admin_endpoint_triggers_sync_and_returns_summary(): void
    {
        $this->fakeCatalogue();
        $provider = $this->makeEasylogsProvider();

        $response = $this->actingAs($this->admin())
            ->postJson("/api/admin/providers/{$provider->id}/easylogs/products/sync", ['markup_percent' => 20]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.created', 1);
    }

    public function test_admin_endpoint_rejects_a_non_easylogs_provider(): void
    {
        $provider = Provider::create([
            'name' => 'Some Other Provider',
            'slug' => 'vtpass-'.Str::random(6),
            'base_url' => 'https://example.test/api',
            'api_key' => 'token',
            'active' => true,
        ]);

        $response = $this->actingAs($this->admin())
            ->postJson("/api/admin/providers/{$provider->id}/easylogs/products/sync");

        $response->assertStatus(422);
    }

    public function test_admin_endpoint_requires_admin(): void
    {
        $this->fakeCatalogue();
        $provider = $this->makeEasylogsProvider();
        $user = User::factory()->create(['is_admin' => false]);

        $response = $this->actingAs($user)
            ->postJson("/api/admin/providers/{$provider->id}/easylogs/products/sync");

        $response->assertStatus(403);
    }
}
