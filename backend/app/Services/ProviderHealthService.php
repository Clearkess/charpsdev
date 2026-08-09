<?php

namespace App\Services;

use App\Models\Provider;
use App\Models\ProviderHealthCheck;
use App\Services\FulfillmentProviders\FulfillmentAdapterResolver;
use Illuminate\Support\Facades\Log;

/**
 * Provider Router (Option A) — owns every write to a Provider's health
 * signal (health_status/failure_count/success_count/last_*_at/
 * cooldown_until), and logs every observation to provider_health_checks.
 * ProviderRouter calls recordSuccess()/recordFailure() after every real
 * fulfilment attempt (passive monitoring); a future scheduled command
 * could additionally call runSyntheticCheck() on a timer for providers
 * that have gone quiet (active monitoring) — not needed for Option A since
 * there is no standardized "ping" endpoint across providers yet, and no
 * real provider credentials exist to ping regardless.
 *
 * Escalation rule (approximated from the existing lifetime counters —
 * deliberately without adding a new "consecutive failures" column):
 * a failure is treated as the START of a new incident when the provider's
 * last recorded outcome before it was a success (or there's no prior
 * failure at all); it's treated as a CONTINUING incident when the
 * provider's last recorded outcome was already a failure with no success
 * since. First failure in an incident -> degraded. Continuing failure in
 * the same incident -> offline. Any success immediately clears back to
 * healthy and cancels any cooldown.
 */
class ProviderHealthService
{
    private const DEGRADED_COOLDOWN_MINUTES = 2;

    private const OFFLINE_COOLDOWN_MINUTES = 10;

    public function recordSuccess(Provider $provider, ?int $responseTimeMs = null): Provider
    {
        $provider->forceFill([
            'success_count' => $provider->success_count + 1,
            'last_success_at' => now(),
            'health_status' => Provider::HEALTH_HEALTHY,
            'cooldown_until' => null,
        ])->save();

        $this->logCheck($provider, Provider::HEALTH_HEALTHY, $responseTimeMs);

        return $provider->refresh();
    }

    public function recordFailure(
        Provider $provider,
        ?string $errorCode = null,
        ?string $errorMessage = null,
        ?int $httpStatus = null,
        ?int $responseTimeMs = null,
    ): Provider {
        $continuingIncident = $provider->last_failure_at !== null
            && (
                $provider->last_success_at === null
                || $provider->last_failure_at->gt($provider->last_success_at)
            );

        $newStatus = $continuingIncident ? Provider::HEALTH_OFFLINE : Provider::HEALTH_DEGRADED;
        $cooldownMinutes = $continuingIncident ? self::OFFLINE_COOLDOWN_MINUTES : self::DEGRADED_COOLDOWN_MINUTES;

        $provider->forceFill([
            'failure_count' => $provider->failure_count + 1,
            'last_failure_at' => now(),
            'health_status' => $newStatus,
            'cooldown_until' => now()->addMinutes($cooldownMinutes),
        ])->save();

        Log::warning('ProviderHealthService: provider marked '.$newStatus, [
            'provider_id' => $provider->id,
            'provider_slug' => $provider->slug,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
        ]);

        $this->logCheck($provider, $newStatus, $responseTimeMs, $httpStatus, $errorCode, $errorMessage);

        return $provider->refresh();
    }

    /**
     * Provider Router (Option B) — active monitoring: calls the resolved
     * adapter's no-side-effect ping() and records the result exactly like
     * a passive fulfil-attempt outcome (same recordSuccess()/
     * recordFailure() escalation rules), so an admin's "Health check" click
     * on the Providers page has the exact same effect on health_status/
     * cooldown as a real order would. Returns the raw ping() result plus
     * the Provider AFTER the resulting state change, for the API response.
     *
     * @return array{ping: array{ok: bool, message: string, raw: array}, provider: Provider}
     */
    public function runSyntheticCheck(Provider $provider): array
    {
        $startedAt = microtime(true);
        $ping = FulfillmentAdapterResolver::resolve($provider)->ping();
        $responseMs = (int) round((microtime(true) - $startedAt) * 1000);

        $provider = $ping['ok']
            ? $this->recordSuccess($provider, $responseMs)
            : $this->recordFailure($provider, 'ping_failed', $ping['message'], null, $responseMs);

        return ['ping' => $ping, 'provider' => $provider];
    }

    private function logCheck(
        Provider $provider,
        string $status,
        ?int $responseTimeMs = null,
        ?int $httpStatus = null,
        ?string $errorCode = null,
        ?string $errorMessage = null,
    ): void {
        ProviderHealthCheck::create([
            'provider_id' => $provider->id,
            'status' => $status,
            'response_time_ms' => $responseTimeMs,
            'http_status' => $httpStatus,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
            'checked_at' => now(),
        ]);

        $provider->forceFill(['last_health_check_at' => now()])->saveQuietly();
    }
}
