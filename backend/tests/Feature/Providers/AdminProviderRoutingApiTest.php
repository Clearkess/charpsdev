<?php

namespace Tests\Feature\Providers;

use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Provider Router (Option B) — HTTP coverage for the new Admin API layer:
 * ProviderController's health endpoints (test/health-check/health/
 * health-summary) and ServiceProviderRouteController's per-service routing
 * CRUD + reorder. Complements ProviderRouterTest (routing decision logic)
 * and CheckoutFulfillmentTest (end-to-end checkout) from Option A, which
 * this segment's work does not change.
 */
class AdminProviderRoutingApiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function makeService(): Service
    {
        return Service::create([
            'name' => 'MTN 1GB Data',
            'slug' => 'mtn-1gb-data-'.Str::random(6),
            'category' => 'vtu',
            'description' => 'Test service',
            'price' => 500,
            'currency' => 'NGN',
            'active' => true,
        ]);
    }

    private function makeProvider(string $slug, string $mode = 'success'): Provider
    {
        return Provider::create([
            'name' => $slug,
            'slug' => $slug.'-'.Str::random(6),
            'base_url' => '',
            'api_key' => 'mock:'.$mode,
            'active' => true,
            'category' => 'vtu',
            'health_status' => Provider::HEALTH_HEALTHY,
        ]);
    }

    public function test_provider_index_exposes_health_and_routing_fields(): void
    {
        $provider = $this->makeProvider('vtpass');

        $response = $this->actingAs($this->admin())->getJson('/api/admin/providers');

        $response->assertOk();
        $data = $response->json('data')[0];
        $this->assertArrayHasKey('health_status', $data);
        $this->assertArrayHasKey('is_routable', $data);
        $this->assertArrayHasKey('success_rate', $data);
        $this->assertArrayHasKey('is_real_adapter', $data);
        $this->assertFalse($data['is_real_adapter']);
        $this->assertSame($provider->id, $data['id']);
    }

    public function test_health_summary_counts_providers_by_status(): void
    {
        $this->makeProvider('vtpass')->update(['health_status' => Provider::HEALTH_HEALTHY]);
        $this->makeProvider('flutterwave')->update(['health_status' => Provider::HEALTH_DEGRADED]);
        $this->makeProvider('paystack')->update(['health_status' => Provider::HEALTH_OFFLINE]);

        $response = $this->actingAs($this->admin())->getJson('/api/admin/providers/health-summary');

        $response->assertOk()->assertJson([
            'success' => true,
            'data' => ['total' => 3, 'healthy' => 1, 'degraded' => 1, 'offline' => 1],
        ]);
    }

    public function test_test_endpoint_pings_without_mutating_health_state(): void
    {
        $provider = $this->makeProvider('vtpass', 'success');

        $response = $this->actingAs($this->admin())->postJson("/api/admin/providers/{$provider->id}/test");

        $response->assertOk()->assertJson(['success' => true, 'data' => ['ok' => true]]);
        // No health-check row written, no counters touched — test() is
        // read-only by design (see ProviderController::test() doc).
        $this->assertSame(0, $provider->fresh()->success_count);
        $this->assertDatabaseCount('provider_health_checks', 0);
    }

    public function test_test_endpoint_reports_failure_for_unreachable_mock(): void
    {
        $provider = $this->makeProvider('vtpass', 'timeout');

        $response = $this->actingAs($this->admin())->postJson("/api/admin/providers/{$provider->id}/test");

        $response->assertOk()->assertJson(['data' => ['ok' => false]]);
    }

    public function test_health_check_endpoint_records_success_and_clears_degraded(): void
    {
        $provider = $this->makeProvider('vtpass', 'success');
        $provider->update(['health_status' => Provider::HEALTH_DEGRADED, 'cooldown_until' => now()->addMinutes(2)]);

        $response = $this->actingAs($this->admin())->postJson("/api/admin/providers/{$provider->id}/health-check");

        $response->assertOk();
        $fresh = $provider->fresh();
        $this->assertSame(Provider::HEALTH_HEALTHY, $fresh->health_status);
        $this->assertNull($fresh->cooldown_until);
        $this->assertSame(1, $fresh->success_count);
        $this->assertDatabaseCount('provider_health_checks', 1);
    }

    public function test_health_check_endpoint_records_failure_and_degrades_provider(): void
    {
        $provider = $this->makeProvider('vtpass', 'timeout');

        $response = $this->actingAs($this->admin())->postJson("/api/admin/providers/{$provider->id}/health-check");

        $response->assertOk()->assertJson(['success' => true]);
        $fresh = $provider->fresh();
        $this->assertSame(Provider::HEALTH_DEGRADED, $fresh->health_status);
        $this->assertSame(1, $fresh->failure_count);
    }

    public function test_health_history_endpoint_returns_recent_checks(): void
    {
        $provider = $this->makeProvider('vtpass', 'success');
        $this->actingAs($this->admin())->postJson("/api/admin/providers/{$provider->id}/health-check");

        $response = $this->actingAs($this->admin())->getJson("/api/admin/providers/{$provider->id}/health");

        $response->assertOk();
        $this->assertCount(1, $response->json('data.checks'));
        $this->assertSame($provider->id, $response->json('data.provider.id'));
    }

    public function test_routing_index_returns_ordered_chain_with_primary_backup_roles(): void
    {
        $service = $this->makeService();
        $primary = $this->makeProvider('vtpass');
        $backup = $this->makeProvider('flutterwave');

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $primary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $response = $this->actingAs($this->admin())->getJson("/api/admin/services/{$service->id}/providers");

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(2, $data);
        $this->assertSame('primary', $data[0]['role']);
        $this->assertSame($primary->id, $data[0]['provider_id']);
        $this->assertSame('backup', $data[1]['role']);
        $this->assertSame($backup->id, $data[1]['provider_id']);
    }

    public function test_routing_store_appends_provider_to_chain(): void
    {
        $service = $this->makeService();
        $provider = $this->makeProvider('vtpass');

        $response = $this->actingAs($this->admin())->postJson("/api/admin/services/{$service->id}/providers", [
            'provider_id' => $provider->id,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('service_provider_routes', [
            'service_id' => $service->id,
            'provider_id' => $provider->id,
            'enabled' => true,
        ]);
    }

    public function test_routing_store_rejects_duplicate_provider_for_same_service(): void
    {
        $service = $this->makeService();
        $provider = $this->makeProvider('vtpass');
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        $response = $this->actingAs($this->admin())->postJson("/api/admin/services/{$service->id}/providers", [
            'provider_id' => $provider->id,
        ]);

        $response->assertStatus(422);
    }

    public function test_routing_update_can_toggle_enabled_and_change_priority(): void
    {
        $service = $this->makeService();
        $provider = $this->makeProvider('vtpass');
        $route = ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        $response = $this->actingAs($this->admin())->putJson(
            "/api/admin/services/{$service->id}/providers/{$route->id}",
            ['enabled' => false, 'priority' => 50],
        );

        $response->assertOk();
        $this->assertFalse($route->fresh()->enabled);
        $this->assertSame(50, $route->fresh()->priority);
    }

    public function test_routing_destroy_removes_entry(): void
    {
        $service = $this->makeService();
        $provider = $this->makeProvider('vtpass');
        $route = ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        $response = $this->actingAs($this->admin())->deleteJson("/api/admin/services/{$service->id}/providers/{$route->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('service_provider_routes', ['id' => $route->id]);
    }

    public function test_routing_destroy_for_route_belonging_to_another_service_is_not_found(): void
    {
        $service = $this->makeService();
        $otherService = $this->makeService();
        $provider = $this->makeProvider('vtpass');
        $route = ServiceProviderRoute::create(['service_id' => $otherService->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        $response = $this->actingAs($this->admin())->deleteJson("/api/admin/services/{$service->id}/providers/{$route->id}");

        $response->assertNotFound();
    }

    public function test_routing_reorder_rewrites_priorities_in_requested_order(): void
    {
        $service = $this->makeService();
        $first = $this->makeProvider('vtpass');
        $second = $this->makeProvider('flutterwave');
        $routeA = ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $first->id, 'priority' => 1, 'enabled' => true]);
        $routeB = ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $second->id, 'priority' => 2, 'enabled' => true]);

        // Reorder so B is now tried before A.
        $response = $this->actingAs($this->admin())->postJson(
            "/api/admin/services/{$service->id}/providers/reorder",
            ['route_ids' => [$routeB->id, $routeA->id]],
        );

        $response->assertOk();
        $this->assertTrue($routeB->fresh()->priority < $routeA->fresh()->priority);
        $this->assertSame('primary', $response->json('data')[0]['role']);
        $this->assertSame($second->id, $response->json('data')[0]['provider_id']);
    }

    public function test_routing_reorder_rejects_mismatched_route_id_set(): void
    {
        $service = $this->makeService();
        $provider = $this->makeProvider('vtpass');
        $route = ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $provider->id, 'priority' => 1, 'enabled' => true]);

        $response = $this->actingAs($this->admin())->postJson(
            "/api/admin/services/{$service->id}/providers/reorder",
            ['route_ids' => [$route->id, 999999]],
        );

        $response->assertStatus(422);
    }

    public function test_non_admin_cannot_access_routing_endpoints(): void
    {
        $service = $this->makeService();
        $user = User::factory()->create(['is_admin' => false]);

        $response = $this->actingAs($user)->getJson("/api/admin/services/{$service->id}/providers");

        $response->assertStatus(403);
    }
}
