<?php

namespace App\Services\SmsProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * 5SIM v1 REST API (https://5sim.net/v1), Bearer JWT auth. Verified live
 * during integration (user/profile, guest/countries, guest/products,
 * user/buy/activation error path, user/check/finish/cancel error paths).
 *
 * Deliberately built against the modern v1 REST API, NOT the legacy
 * api1.5sim.net/stubs/handler_api.php key-param API: that endpoint is
 * Cloudflare-blocked from this app's outbound IP and expects a different
 * (non-JWT) key format anyway.
 *
 * All "buy" style endpoints can return a plain-text error body (e.g.
 * "not enough user balance", "order not found") instead of JSON — every
 * call here checks for that before attempting to decode JSON.
 */
class FiveSimProvider implements SmsProviderInterface
{
    /** Countries this account has never had a product take, kept out of listCountries() clutter is NOT done — full raw list is returned as-is. */
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = 'https://5sim.net/v1',
    ) {
    }

    private function client()
    {
        return Http::withToken($this->apiKey)
            ->acceptJson()
            ->timeout(20);
    }

    /**
     * 5SIM plain-text errors (e.g. "not enough user balance", "order not
     * found", "no free phones") come back with a 200 or 400 status and a
     * text/plain body, not JSON. Guzzle's json() throws on that; guard
     * with a content-type + first-character sniff instead.
     */
    private function decode($response): array
    {
        $body = trim((string) $response->body());

        if ($response->failed() && ! str_starts_with($body, '{') && ! str_starts_with($body, '[')) {
            throw new SmsProviderException("5SIM: {$body}");
        }

        $json = $response->json();

        if (! is_array($json)) {
            // Successful (2xx) but plain-text body, e.g. "order not found"
            // returned with a 200 in some edge cases, or "no free phones".
            throw new SmsProviderException('5SIM: ' . ($body !== '' ? $body : 'unexpected response'));
        }

        return $json;
    }

    public function getBalance(): float
    {
        $data = $this->decode($this->client()->get("{$this->baseUrl}/user/profile"));

        return (float) ($data['balance'] ?? 0);
    }

    public function listCountries(): array
    {
        $response = Http::acceptJson()->timeout(20)->get("{$this->baseUrl}/guest/countries");
        $data = $this->decode($response);

        $countries = [];
        foreach ($data as $slug => $info) {
            if (! is_array($info)) {
                continue;
            }
            $countries[] = [
                'code' => (string) $slug,
                'name' => $info['text_en'] ?? $info['name'] ?? (string) $slug,
            ];
        }

        usort($countries, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $countries;
    }

    public function listServices(string $country): array
    {
        $response = Http::acceptJson()->timeout(20)->get("{$this->baseUrl}/guest/products/{$country}/any");
        $data = $this->decode($response);

        $services = [];
        foreach ($data as $code => $info) {
            if (! is_array($info)) {
                continue;
            }
            // Restrict to "activation" products: buyNumber() below only
            // implements /user/buy/activation/... (the OTP-receiving use
            // case). 5SIM's "hosting" category is a different long-term
            // rental product not modeled by this feature.
            if (($info['Category'] ?? 'activation') !== 'activation') {
                continue;
            }
            $services[] = [
                'code' => (string) $code,
                'name' => (string) $code,
                'cost_usd' => (float) ($info['Price'] ?? 0),
                'count' => (int) ($info['Qty'] ?? 0),
            ];
        }

        usort($services, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $services;
    }

    public function buyNumber(string $country, string $service): array
    {
        $data = $this->decode(
            $this->client()->get("{$this->baseUrl}/user/buy/activation/{$country}/any/{$service}")
        );

        if (! isset($data['id'])) {
            throw new SmsProviderException('5SIM: unexpected buy response');
        }

        return [
            'external_id' => (string) $data['id'],
            'phone_number' => $data['phone'] ?? null,
            'cost_usd' => (float) ($data['price'] ?? 0),
            'operator' => $data['operator'] ?? null,
            'expires_at' => $data['expires'] ?? null,
            'raw' => $data,
        ];
    }

    /**
     * Maps 5SIM's activation lifecycle statuses onto our unified set.
     * PENDING = still waiting for the SMS; RECEIVED/FINISHED = code
     * arrived (FINISHED only happens after our own finish() call, but a
     * poll landing on it mid-flight should still read as "received");
     * CANCELED = we (or the provider) cancelled; TIMEOUT/BANNED = no code
     * arrived in time / number got banned by the target service, both of
     * which are terminal failures from the customer's point of view.
     */
    private function mapStatus(string $status): string
    {
        return match (strtoupper($status)) {
            'PENDING' => 'waiting',
            'RECEIVED', 'FINISHED' => 'received',
            'CANCELED' => 'cancelled',
            'TIMEOUT' => 'expired',
            'BANNED' => 'failed',
            default => 'waiting',
        };
    }

    public function checkStatus(string $externalId): array
    {
        $response = $this->client()->get("{$this->baseUrl}/user/check/{$externalId}");

        if ($response->status() === 404) {
            throw new SmsProviderException('5SIM: order not found');
        }

        $data = $this->decode($response);

        $sms = collect($data['sms'] ?? [])->last();

        return [
            'status' => $this->mapStatus((string) ($data['status'] ?? 'PENDING')),
            'sms_code' => $sms['code'] ?? null,
            'sms_text' => $sms['text'] ?? null,
            'raw' => $data,
        ];
    }

    public function finish(string $externalId): bool
    {
        $response = $this->client()->get("{$this->baseUrl}/user/finish/{$externalId}");

        if ($response->status() === 404) {
            // Already finished / never existed on 5SIM's side — treat as
            // a no-op success rather than surfacing an error for a state
            // that's already terminal from our side too.
            return false;
        }

        if ($response->failed()) {
            Log::warning('5SIM finish() failed', ['id' => $externalId, 'body' => $response->body()]);

            return false;
        }

        return true;
    }

    public function cancel(string $externalId): bool
    {
        $response = $this->client()->get("{$this->baseUrl}/user/cancel/{$externalId}");

        if ($response->status() === 404) {
            return false;
        }

        if ($response->failed()) {
            Log::warning('5SIM cancel() failed', ['id' => $externalId, 'body' => $response->body()]);

            return false;
        }

        return true;
    }
}
