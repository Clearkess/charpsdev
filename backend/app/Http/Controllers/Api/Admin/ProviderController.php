<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Models\ProviderHealthCheck;
use App\Services\FulfillmentProviders\FulfillmentAdapterResolver;
use App\Services\ProviderHealthService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProviderController extends Controller
{
    public function __construct(private readonly ProviderHealthService $health) {}

    /**
     * `api_key` is a credential (used server-side to call a provider's own
     * API for stock/delivery sync in a later phase) and must never be sent
     * back to the browser in full. Every response masks it to a short
     * "last 4 chars" hint so admins can recognize which key is set without
     * the plaintext ever leaving the server after creation.
     */
    private function maskKey(?string $key): ?string
    {
        if (! $key) {
            return null;
        }

        $tail = Str::substr($key, -4);

        return Str::length($key) > 4 ? "••••{$tail}" : '••••';
    }

    /**
     * Provider Router (Option B): now also exposes every routing/health
     * field added to `providers` in Option A (category, priority,
     * is_primary/is_backup, health_status, failure/success counters,
     * last_*_at timestamps, cooldown_until, timeout_seconds) plus a derived
     * `success_rate` and `is_routable`/`is_real_adapter` flags — everything
     * the admin Provider Health summary panel and per-row health badge
     * need, without the frontend having to re-derive isRoutable()'s
     * cooldown logic itself.
     */
    private function present(Provider $provider): array
    {
        $totalAttempts = $provider->success_count + $provider->failure_count;

        return [
            'id' => $provider->id,
            'name' => $provider->name,
            'slug' => $provider->slug,
            'base_url' => $provider->base_url,
            'api_key_masked' => $this->maskKey($provider->api_key),
            'has_api_key' => filled($provider->api_key),
            'active' => $provider->active,
            'services_count' => $provider->services_count ?? $provider->services()->count(),
            'category' => $provider->category,
            'priority' => $provider->priority,
            'is_primary' => $provider->is_primary,
            'is_backup' => $provider->is_backup,
            'health_status' => $provider->health_status,
            'is_routable' => $provider->isRoutable(),
            'is_in_cooldown' => $provider->isInCooldown(),
            'cooldown_until' => $provider->cooldown_until,
            'failure_count' => $provider->failure_count,
            'success_count' => $provider->success_count,
            'success_rate' => $totalAttempts > 0
                ? round(($provider->success_count / $totalAttempts) * 100, 1)
                : null,
            'last_success_at' => $provider->last_success_at,
            'last_failure_at' => $provider->last_failure_at,
            'last_health_check_at' => $provider->last_health_check_at,
            'timeout_seconds' => $provider->timeout_seconds,
            'is_real_adapter' => FulfillmentAdapterResolver::isRealAdapter($provider),
            'created_at' => $provider->created_at,
            'updated_at' => $provider->updated_at,
        ];
    }

    public function index()
    {
        $providers = Provider::withCount('services')->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $providers->map(fn (Provider $provider) => $this->present($provider)),
        ]);
    }

    /**
     * Provider Router (Option B): powers the Providers page's "Provider
     * Health summary panel" (e.g. "12 Providers, 9 Healthy, 2 Degraded, 1
     * Offline") without the frontend re-counting the full provider list
     * itself — cheap to compute here since it's a single grouped query.
     */
    public function healthSummary()
    {
        $counts = Provider::query()
            ->selectRaw('health_status, count(*) as total')
            ->groupBy('health_status')
            ->pluck('total', 'health_status');

        return response()->json([
            'success' => true,
            'data' => [
                'total' => (int) $counts->sum(),
                'healthy' => (int) ($counts[Provider::HEALTH_HEALTHY] ?? 0),
                'degraded' => (int) ($counts[Provider::HEALTH_DEGRADED] ?? 0),
                'offline' => (int) ($counts[Provider::HEALTH_OFFLINE] ?? 0),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'base_url' => 'required|url|max:2048',
            'api_key' => 'required|string|max:2048',
            'active' => 'boolean',
            'category' => 'nullable|string|max:255',
            'priority' => 'nullable|integer|min:0',
            'is_primary' => 'boolean',
            'is_backup' => 'boolean',
            'timeout_seconds' => 'nullable|integer|min:1|max:300',
        ]);

        $slug = Str::slug($data['name']);
        if (Provider::where('slug', $slug)->exists()) {
            $slug .= '-'.time();
        }

        $provider = Provider::create([
            'name' => $data['name'],
            'slug' => $slug,
            'base_url' => $data['base_url'],
            'api_key' => $data['api_key'],
            'active' => $data['active'] ?? true,
            'category' => $data['category'] ?? null,
            'priority' => $data['priority'] ?? 100,
            'is_primary' => $data['is_primary'] ?? false,
            'is_backup' => $data['is_backup'] ?? false,
            'timeout_seconds' => $data['timeout_seconds'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Provider created successfully.',
            'data' => $this->present($provider),
        ], 201);
    }

    public function update(Request $request, Provider $provider)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'base_url' => 'sometimes|url|max:2048',
            // Optional on update: an admin editing a provider shouldn't be
            // forced to re-paste the secret key every time just to toggle
            // `active` or fix a typo in the name.
            'api_key' => 'nullable|string|max:2048',
            'active' => 'boolean',
            'category' => 'nullable|string|max:255',
            'priority' => 'nullable|integer|min:0',
            'is_primary' => 'boolean',
            'is_backup' => 'boolean',
            'timeout_seconds' => 'nullable|integer|min:1|max:300',
        ]);

        if (isset($data['name'])) {
            $slug = Str::slug($data['name']);
            if (Provider::where('slug', $slug)->where('id', '!=', $provider->id)->exists()) {
                $slug .= '-'.time();
            }
            $data['slug'] = $slug;
        }

        if (array_key_exists('api_key', $data) && blank($data['api_key'])) {
            unset($data['api_key']);
        }

        $provider->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Provider updated successfully.',
            'data' => $this->present($provider->fresh()),
        ]);
    }

    public function destroy(Provider $provider)
    {
        if ($provider->services()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a provider that still has services assigned. Reassign or delete its services first.',
            ], 422);
        }

        $provider->delete();

        return response()->json([
            'success' => true,
            'message' => 'Provider deleted successfully.',
        ]);
    }

    /**
     * Provider Router (Option B) — POST /admin/providers/{provider}/test.
     * A read-only connectivity/credential check (adapter's ping()) that
     * does NOT affect health_status/cooldown or write a health-check row —
     * distinct from healthCheck() below. Lets an admin sanity-check a
     * freshly-pasted API key without any risk of tripping the provider
     * into 'degraded'/'offline' from a single manual click.
     */
    public function test(Provider $provider)
    {
        $result = FulfillmentAdapterResolver::resolve($provider)->ping();

        return response()->json([
            'success' => true,
            'data' => [
                'ok' => $result['ok'],
                'message' => $result['message'],
                'is_real_adapter' => FulfillmentAdapterResolver::isRealAdapter($provider),
            ],
        ]);
    }

    /**
     * Provider Router (Option B) — POST /admin/providers/{provider}/health-check.
     * Runs ProviderHealthService::runSyntheticCheck(), which DOES affect
     * health_status/cooldown/counters exactly like a real fulfilment
     * attempt would (see ProviderHealthService doc comment) — this is the
     * "did this provider actually recover" check, not a harmless ping.
     */
    public function healthCheck(Provider $provider)
    {
        $result = $this->health->runSyntheticCheck($provider);

        return response()->json([
            'success' => true,
            'message' => $result['ping']['ok']
                ? 'Health check passed.'
                : 'Health check failed: '.$result['ping']['message'],
            'data' => $this->present($result['provider']),
        ]);
    }

    /**
     * Provider Router (Option B) — GET /admin/providers/{provider}/health.
     * Recent provider_health_checks history (most recent first) plus the
     * provider's current live stats, for a future health-history drill-down
     * (e.g. a modal from the Providers page) beyond the summary numbers
     * already in present()/healthSummary().
     */
    public function health(Request $request, Provider $provider)
    {
        $limit = min((int) $request->query('limit', 20), 100);

        $checks = ProviderHealthCheck::where('provider_id', $provider->id)
            ->orderByDesc('checked_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'provider' => $this->present($provider),
                'checks' => $checks,
            ],
        ]);
    }
}
