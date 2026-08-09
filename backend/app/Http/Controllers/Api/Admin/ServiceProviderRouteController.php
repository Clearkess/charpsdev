<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Models\Service;
use App\Models\ServiceProviderRoute;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Provider Router (Option B) — backs the per-service "Routing editor" UI
 * (mockup: "MTN 1GB" listing providers with PRIMARY/BACKUP/SECONDARY
 * labels, Enabled toggle, Priority input, "+ Add provider", drag-to-
 * reorder, "Save routing"). CRUD + reorder on service_provider_routes,
 * scoped to one Service — mirrors AdminServiceController/ProviderController
 * conventions (validate -> mutate -> return a JSON-friendly shape).
 */
class ServiceProviderRouteController extends Controller
{
    /**
     * `priority` is the only field ProviderRouter actually orders by
     * (lower = tried first); `is_primary`/`is_backup` are derived purely
     * for display (position 1 = PRIMARY, everything else = BACKUP) rather
     * than stored per-route — the routes table's `priority` column is
     * already the single source of truth for order, so a separate stored
     * "is_primary" per route would just be redundant state to keep in
     * sync. (Provider::is_primary/is_backup — the two boolean columns on
     * `providers` from Option A's migration — describe the PROVIDER's
     * general role across the whole platform, not this one service's
     * chain position; deliberately left untouched here.)
     */
    private function present(ServiceProviderRoute $route, int $position): array
    {
        $provider = $route->provider;
        $totalAttempts = $route->success_count + $route->failure_count;

        return [
            'id' => $route->id,
            'service_id' => $route->service_id,
            'provider_id' => $route->provider_id,
            'provider' => $provider ? [
                'id' => $provider->id,
                'name' => $provider->name,
                'slug' => $provider->slug,
                'active' => $provider->active,
                'health_status' => $provider->health_status,
                'is_routable' => $provider->isRoutable(),
            ] : null,
            'priority' => $route->priority,
            'enabled' => $route->enabled,
            'role' => $position === 1 ? 'primary' : 'backup',
            'position' => $position,
            'provider_service_id' => $route->provider_service_id,
            'provider_cost' => $route->provider_cost,
            'failure_count' => $route->failure_count,
            'success_count' => $route->success_count,
            'success_rate' => $totalAttempts > 0
                ? round(($route->success_count / $totalAttempts) * 100, 1)
                : null,
            'last_success_at' => $route->last_success_at,
            'last_failure_at' => $route->last_failure_at,
        ];
    }

    /**
     * GET /admin/services/{service}/providers — the routing chain in the
     * exact order ProviderRouter would try it (matches
     * ProviderRouter::routableRoutes()'s ordering, but WITHOUT its
     * enabled/isRoutable() filtering — the editor must show disabled and
     * currently-unhealthy routes too, not hide them).
     */
    public function index(Service $service)
    {
        $routes = $service->providerRoutes()
            ->with('provider')
            ->orderBy('priority')
            ->orderBy('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $routes->values()->map(
                fn (ServiceProviderRoute $route, int $index) => $this->present($route, $index + 1)
            ),
        ]);
    }

    /**
     * POST /admin/services/{service}/providers — "+ Add provider". Appends
     * at the end of the chain by default (priority = current max + 10,
     * leaving gaps for a future manual insert) unless the caller supplies
     * an explicit priority.
     */
    public function store(Request $request, Service $service)
    {
        $data = $request->validate([
            'provider_id' => 'required|exists:providers,id',
            'priority' => 'nullable|integer|min:0',
            'enabled' => 'boolean',
            'provider_service_id' => 'nullable|string|max:255',
            'provider_cost' => 'nullable|numeric|min:0',
        ]);

        if ($service->providerRoutes()->where('provider_id', $data['provider_id'])->exists()) {
            throw ValidationException::withMessages([
                'provider_id' => 'This provider is already in this service\'s routing chain.',
            ]);
        }

        $priority = $data['priority'] ?? (
            (int) ($service->providerRoutes()->max('priority') ?? 0) + 10
        );

        $route = $service->providerRoutes()->create([
            'provider_id' => $data['provider_id'],
            'priority' => $priority,
            'enabled' => $data['enabled'] ?? true,
            'provider_service_id' => $data['provider_service_id'] ?? null,
            'provider_cost' => $data['provider_cost'] ?? null,
        ]);

        $route->load('provider');

        return response()->json([
            'success' => true,
            'message' => 'Provider added to routing chain.',
            'data' => $this->present($route, $this->positionOf($service, $route)),
        ], 201);
    }

    /**
     * PUT /admin/services/{service}/providers/{route} — edit one route's
     * priority/enabled/provider_service_id/provider_cost. Does not allow
     * changing provider_id (delete + re-add instead, so failure_count/
     * success_count history for a route always belongs to one fixed
     * provider for its whole life).
     */
    public function update(Request $request, Service $service, ServiceProviderRoute $route)
    {
        $this->ensureBelongsToService($service, $route);

        $data = $request->validate([
            'priority' => 'sometimes|integer|min:0',
            'enabled' => 'boolean',
            'provider_service_id' => 'nullable|string|max:255',
            'provider_cost' => 'nullable|numeric|min:0',
        ]);

        $route->update($data);

        $route->refresh()->load('provider');

        return response()->json([
            'success' => true,
            'message' => 'Routing entry updated.',
            'data' => $this->present($route, $this->positionOf($service, $route)),
        ]);
    }

    /**
     * DELETE /admin/services/{service}/providers/{route} — remove a
     * provider from this service's routing chain entirely (its
     * failure_count/success_count history goes with it; unlike disabling
     * via `enabled=false`, which keeps that history for later reference).
     */
    public function destroy(Service $service, ServiceProviderRoute $route)
    {
        $this->ensureBelongsToService($service, $route);

        $route->delete();

        return response()->json([
            'success' => true,
            'message' => 'Provider removed from routing chain.',
        ]);
    }

    /**
     * POST /admin/services/{service}/providers/reorder — the "Save
     * routing" / drag-to-reorder action. Accepts the FULL new order as a
     * flat list of route IDs (belonging to this service) and rewrites
     * `priority` for every one of them in a single pass (1, 2, 3, ... in
     * list order) — simpler and less error-prone for the frontend than
     * asking it to compute/send its own priority numbers.
     */
    public function reorder(Request $request, Service $service)
    {
        $data = $request->validate([
            'route_ids' => 'required|array|min:1',
            'route_ids.*' => 'integer',
        ]);

        $existingIds = $service->providerRoutes()->pluck('id');

        if ($existingIds->count() !== count($data['route_ids']) || $existingIds->diff($data['route_ids'])->isNotEmpty()) {
            throw ValidationException::withMessages([
                'route_ids' => 'route_ids must contain exactly the current routing entries for this service, in the desired order.',
            ]);
        }

        foreach ($data['route_ids'] as $index => $routeId) {
            ServiceProviderRoute::where('id', $routeId)->update(['priority' => ($index + 1) * 10]);
        }

        $routes = $service->providerRoutes()->with('provider')->orderBy('priority')->orderBy('id')->get();

        return response()->json([
            'success' => true,
            'message' => 'Routing order saved.',
            'data' => $routes->values()->map(
                fn (ServiceProviderRoute $route, int $index) => $this->present($route, $index + 1)
            ),
        ]);
    }

    /**
     * GET /admin/providers/{provider}/services — the reverse lookup: every
     * service this provider currently routes for, for a potential future
     * "where is this provider used" view from the Providers page. Not part
     * of the original endpoint list but a natural, cheap complement to
     * index() above; not yet wired into any UI.
     */
    public function servicesForProvider(Provider $provider)
    {
        $routes = $provider->serviceRoutes()->with('service')->orderBy('service_id')->get();

        return response()->json([
            'success' => true,
            'data' => $routes->map(fn (ServiceProviderRoute $route) => [
                'service_id' => $route->service_id,
                'service_name' => $route->service?->name,
                'priority' => $route->priority,
                'enabled' => $route->enabled,
            ]),
        ]);
    }

    private function ensureBelongsToService(Service $service, ServiceProviderRoute $route): void
    {
        abort_unless($route->service_id === $service->id, 404);
    }

    private function positionOf(Service $service, ServiceProviderRoute $route): int
    {
        $orderedIds = $service->providerRoutes()->orderBy('priority')->orderBy('id')->pluck('id');

        return (int) $orderedIds->search($route->id) + 1;
    }
}
