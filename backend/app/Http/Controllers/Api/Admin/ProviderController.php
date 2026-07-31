<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProviderController extends Controller
{
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

    private function present(Provider $provider): array
    {
        return [
            'id' => $provider->id,
            'name' => $provider->name,
            'slug' => $provider->slug,
            'base_url' => $provider->base_url,
            'api_key_masked' => $this->maskKey($provider->api_key),
            'has_api_key' => filled($provider->api_key),
            'active' => $provider->active,
            'services_count' => $provider->services_count ?? $provider->services()->count(),
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

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'base_url' => 'required|url|max:2048',
            'api_key' => 'required|string|max:2048',
            'active' => 'boolean',
        ]);

        $slug = Str::slug($data['name']);
        if (Provider::where('slug', $slug)->exists()) {
            $slug .= '-' . time();
        }

        $provider = Provider::create([
            'name' => $data['name'],
            'slug' => $slug,
            'base_url' => $data['base_url'],
            'api_key' => $data['api_key'],
            'active' => $data['active'] ?? true,
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
        ]);

        if (isset($data['name'])) {
            $slug = Str::slug($data['name']);
            if (Provider::where('slug', $slug)->where('id', '!=', $provider->id)->exists()) {
                $slug .= '-' . time();
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
}
