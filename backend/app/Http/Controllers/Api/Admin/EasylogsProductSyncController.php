<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Services\Providers\EasylogsProductSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Provider Router (Option B) — POST /admin/providers/{provider}/easylogs/products/sync.
 * Admin-triggered catalogue import (see EasylogsProductSyncService's class
 * doc comment for why this creates a service_provider_routes entry per
 * product rather than just a Service row). Gated to the exact 'easylogs'
 * slug, mirroring FulfillmentAdapterResolver's convention, so this can
 * never be pointed at an unrelated provider by mistake.
 */
class EasylogsProductSyncController extends Controller
{
    public function sync(Request $request, Provider $provider, EasylogsProductSyncService $syncService)
    {
        $data = $request->validate([
            'currency' => ['nullable', 'string', 'size:3'],
            'markup_percent' => ['nullable', 'numeric', 'min:0', 'max:500'],
        ]);

        if ($provider->slug !== 'easylogs') {
            return response()->json([
                'success' => false,
                'message' => 'This provider is not configured as an Easylogs provider (slug must be exactly "easylogs").',
            ], 422);
        }

        try {
            $result = $syncService->sync(
                $provider,
                strtoupper($data['currency'] ?? 'NGN'),
                (float) ($data['markup_percent'] ?? 20),
            );

            return response()->json([
                'success' => true,
                'message' => "Easylogs sync completed: {$result['created']} created, {$result['updated']} updated, {$result['skipped']} skipped.",
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            Log::error('Easylogs product sync failed', ['provider_id' => $provider->id, 'error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 502);
        }
    }
}
