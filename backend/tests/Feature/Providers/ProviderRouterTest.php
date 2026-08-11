<?php

namespace Tests\Feature\Providers;

use App\Models\Order;
use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use App\Models\User;
use App\Services\ProviderHealthService;
use App\Services\ProviderRouter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Provider Router (Option A) — direct unit-style coverage of
 * ProviderRouter's failover decision logic, isolated from the HTTP/
 * checkout layer (see CheckoutFulfillmentTest for the end-to-end path).
 * Each mock provider's simulated behaviour is driven entirely by its
 * `api_key` value (see MockFulfillmentProvider's doc comment).
 */
class ProviderRouterTest extends TestCase
{
    use RefreshDatabase;

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

    private function makeProvider(string $slug, string $mode, int $priority = 100): Provider
    {
        return Provider::create([
            'name' => $slug,
            'slug' => $slug.'-'.Str::random(6),
            'base_url' => '',
            'api_key' => 'mock:'.$mode,
            'active' => true,
            'category' => 'vtu',
            'priority' => $priority,
            'health_status' => Provider::HEALTH_HEALTHY,
        ]);
    }

    private function makeOrder(): Order
    {
        $user = User::factory()->create();

        return Order::create([
            'user_id' => $user->id,
            'reference' => 'ORD-'.Str::upper(Str::random(10)),
            'amount' => 500,
            'status' => 'pending',
        ]);
    }

    private function router(): ProviderRouter
    {
        return new ProviderRouter(new ProviderHealthService);
    }

    public function test_primary_provider_success_never_touches_backup(): void
    {
        $service = $this->makeService();
        $primary = $this->makeProvider('vtpass', 'success');
        $backup = $this->makeProvider('flutterwave', 'success');

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $primary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        $this->assertSame('completed', $result['outcome']);
        $this->assertSame($primary->id, $result['provider_id']);
        $this->assertCount(1, $result['attempts']);

        $this->assertSame(1, $primary->fresh()->success_count);
        $this->assertSame(0, $backup->fresh()->success_count);
    }

    public function test_retryable_failure_on_primary_fails_over_to_backup(): void
    {
        $service = $this->makeService();
        $primary = $this->makeProvider('vtpass', 'timeout', priority: 1);
        $backup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $primary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        $this->assertSame('completed', $result['outcome']);
        $this->assertSame($backup->id, $result['provider_id']);
        $this->assertCount(2, $result['attempts']);
        $this->assertSame('failed', $result['attempts'][0]['outcome']);
        $this->assertSame('retryable', $result['attempts'][0]['error_type']);

        $this->assertSame(1, $primary->fresh()->failure_count);
        $this->assertSame('degraded', $primary->fresh()->health_status);
        $this->assertSame(1, $backup->fresh()->success_count);
    }

    public function test_non_retryable_failure_stops_chain_without_trying_backup(): void
    {
        $service = $this->makeService();
        $primary = $this->makeProvider('vtpass', 'invalid_recipient', priority: 1);
        $backup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $primary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        $this->assertSame('rejected', $result['outcome']);
        $this->assertSame($primary->id, $result['provider_id']);
        // Only 1 attempt: the backup must never be called for a
        // NonRetryable failure (this would fail identically everywhere).
        $this->assertCount(1, $result['attempts']);
        $this->assertSame(0, $backup->fresh()->success_count);
        $this->assertSame(0, $backup->fresh()->failure_count);
    }

    public function test_ambiguous_failure_that_actually_completed_is_resolved_without_failover(): void
    {
        $service = $this->makeService();
        $primary = $this->makeProvider('vtpass', 'ambiguous_timeout', priority: 1);
        $backup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $primary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        // Critical assertion: the ambiguous timeout on the primary actually
        // completed upstream -> checkStatus() confirms it -> router MUST
        // resolve this as a success on the PRIMARY, never call the backup
        // (that would be the double-fulfilment bug the whole rule exists
        // to prevent).
        $this->assertSame('completed', $result['outcome']);
        $this->assertSame($primary->id, $result['provider_id']);
        $this->assertCount(1, $result['attempts']);
        $this->assertSame(0, $backup->fresh()->success_count);
    }

    public function test_all_providers_exhausted_with_retryable_failures_goes_to_manual_review(): void
    {
        $service = $this->makeService();
        $primary = $this->makeProvider('vtpass', 'timeout', priority: 1);
        $backup = $this->makeProvider('flutterwave', 'connection_failure', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $primary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        $this->assertSame('manual_review', $result['outcome']);
        $this->assertCount(2, $result['attempts']);
    }

    public function test_service_with_no_routes_returns_no_routes(): void
    {
        $service = $this->makeService();
        $order = $this->makeOrder();

        $result = $this->router()->route($service, $order);

        $this->assertSame('no_routes', $result['outcome']);
        $this->assertEmpty($result['attempts']);
    }

    public function test_disabled_route_is_skipped(): void
    {
        $service = $this->makeService();
        $disabledPrimary = $this->makeProvider('vtpass', 'success', priority: 1);
        $enabledBackup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $disabledPrimary->id, 'priority' => 1, 'enabled' => false]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $enabledBackup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        $this->assertSame($enabledBackup->id, $result['provider_id']);
    }

    public function test_inactive_provider_is_skipped_even_if_route_enabled(): void
    {
        $service = $this->makeService();
        $inactivePrimary = $this->makeProvider('vtpass', 'success', priority: 1);
        $inactivePrimary->update(['active' => false]);
        $backup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $inactivePrimary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        $this->assertSame($backup->id, $result['provider_id']);
    }

    public function test_provider_in_cooldown_is_skipped(): void
    {
        $service = $this->makeService();
        $cooldownPrimary = $this->makeProvider('vtpass', 'success', priority: 1);
        $cooldownPrimary->update(['cooldown_until' => now()->addMinutes(5)]);
        $backup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $cooldownPrimary->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $order = $this->makeOrder();
        $result = $this->router()->route($service, $order);

        $this->assertSame($backup->id, $result['provider_id']);
    }

    public function test_repeated_failure_escalates_provider_from_degraded_to_offline(): void
    {
        $service = $this->makeService();
        $failing = $this->makeProvider('vtpass', 'timeout', priority: 1);
        $backup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $failing->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $router = $this->router();

        $router->route($service, $this->makeOrder());
        $this->assertSame('degraded', $failing->fresh()->health_status);

        // Clear the cooldown so the second attempt actually reaches this
        // provider again rather than being pre-filtered as routable=false
        // (a real second failure minutes later would have its cooldown
        // naturally expired by then; we simulate that here).
        $failing->fresh()->forceFill(['cooldown_until' => null])->save();

        $router->route($service, $this->makeOrder());
        $this->assertSame('offline', $failing->fresh()->health_status);
    }

    /**
     * Regression test for a production incident (order #18,
     * ORD-QZ4ITOZ7YE): a provider that escalated to 'offline' remained
     * permanently un-routable even after its cooldown_until naturally
     * passed, because isRoutable() used to exclude 'offline' outright
     * instead of relying on isInCooldown() the way it already did for
     * 'degraded'. This asserts the corrected behaviour: once cooldown_until
     * is in the past, an 'offline' provider must be tried again on its own
     * (no manual admin "Health check" click required), and a subsequent
     * success must clear it back to 'healthy'.
     */
    public function test_offline_provider_becomes_routable_again_once_cooldown_naturally_expires(): void
    {
        $service = $this->makeService();
        $failing = $this->makeProvider('vtpass', 'timeout', priority: 1);
        $backup = $this->makeProvider('flutterwave', 'success', priority: 2);

        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $failing->id, 'priority' => 1, 'enabled' => true]);
        ServiceProviderRoute::create(['service_id' => $service->id, 'provider_id' => $backup->id, 'priority' => 2, 'enabled' => true]);

        $router = $this->router();

        $router->route($service, $this->makeOrder());
        $this->assertSame('degraded', $failing->fresh()->health_status);

        $failing->fresh()->forceFill(['cooldown_until' => null])->save();

        $router->route($service, $this->makeOrder());
        $this->assertSame('offline', $failing->fresh()->health_status);

        // Simulate the cooldown naturally expiring (a moment already in
        // the past, exactly what happens once OFFLINE_COOLDOWN_MINUTES
        // elapses in real time -- unlike the two force-clears above, this
        // does NOT null it out, to prove isInCooldown() alone is what
        // correctly re-admits the provider) and the underlying issue being
        // resolved (e.g. the provider's account being topped up), mirroring
        // the production incident that surfaced this bug.
        $failing->fresh()->forceFill([
            'cooldown_until' => now()->subMinute(),
            'api_key' => 'mock:success',
        ])->save();

        $result = $router->route($service, $this->makeOrder());

        $this->assertSame($failing->id, $result['provider_id']);
        $this->assertSame('healthy', $failing->fresh()->health_status);
    }
}
