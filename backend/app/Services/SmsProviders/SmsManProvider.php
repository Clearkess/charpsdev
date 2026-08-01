<?php

namespace App\Services\SmsProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SMS-Man API (https://api.sms-man.com/control), `token` query param
 * auth. Built strictly from https://sms-man.com/site/api's published
 * request/response shapes.
 *
 * NOT LIVE-VERIFIED: no SMS-Man API token has been provided yet, so
 * every call here is untested against the real service. Provider row
 * for this adapter should stay `active = false` until a token is
 * supplied and at least getBalance()/listCountries() have been smoke
 * tested against it.
 */
class SmsManProvider implements SmsProviderInterface
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = 'https://api.sms-man.com/control',
    ) {
    }

    private function get(string $path, array $query = []): array
    {
        $response = Http::acceptJson()->timeout(20)->get("{$this->baseUrl}/{$path}", array_merge([
            'token' => $this->apiKey,
        ], $query));

        $data = $response->json();

        if (! is_array($data)) {
            throw new SmsProviderException('SMS-Man: unexpected response from ' . $path);
        }

        if (isset($data['success']) && $data['success'] === false) {
            $message = is_array($data['error_msg'] ?? null)
                ? json_encode($data['error_msg'])
                : (string) ($data['error_msg'] ?? $data['error_code'] ?? 'unknown error');
            throw new SmsProviderException("SMS-Man: {$message}");
        }

        if (isset($data['error_code'])) {
            throw new SmsProviderException('SMS-Man: ' . (is_array($data['error_msg'] ?? null) ? json_encode($data['error_msg']) : ($data['error_msg'] ?? $data['error_code'])));
        }

        return $data;
    }

    public function getBalance(): float
    {
        $data = $this->get('get-balance');

        return (float) ($data['balance'] ?? 0);
    }

    /**
     * `country` values used throughout this adapter are SMS-Man's own
     * numeric `country_id` (as strings, to match this interface's
     * string-typed country/service params), e.g. "0" = Russia, "1" = ?
     * per SMS-Man's own /countries list — not an ISO code or dialling
     * code, and not comparable to 5SIM's or OnlineSIM's country codes.
     */
    public function listCountries(): array
    {
        $data = $this->get('countries');

        $list = is_array($data) && array_is_list($data) ? $data : ($data['countries'] ?? []);

        $countries = [];
        foreach ($list as $entry) {
            if (! is_array($entry) || ! isset($entry['id'])) {
                continue;
            }
            $countries[] = [
                'code' => (string) $entry['id'],
                'name' => (string) ($entry['title'] ?? $entry['id']),
            ];
        }

        usort($countries, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $countries;
    }

    /**
     * SMS-Man has no single "services for country X" endpoint; the
     * closest fit is get-prices?country_id=X, a nested
     * {application_id: {cost, count}} map that also carries availability
     * counts. Service *names* come from a separate global /applications
     * list, so this method joins the two (one extra request) to give
     * callers a human-readable name instead of a bare application_id.
     */
    public function listServices(string $country): array
    {
        $prices = $this->get('get-prices', ['country_id' => $country]);
        $byCountry = $prices[$country] ?? reset($prices) ?: [];

        if (! is_array($byCountry)) {
            return [];
        }

        $applications = $this->get('applications');
        $appList = is_array($applications) && array_is_list($applications) ? $applications : ($applications['applications'] ?? []);
        $names = collect($appList)->keyBy(fn ($a) => (string) ($a['id'] ?? ''));

        $services = [];
        foreach ($byCountry as $applicationId => $info) {
            if (! is_array($info)) {
                continue;
            }
            $services[] = [
                'code' => (string) $applicationId,
                'name' => (string) ($names[(string) $applicationId]['name'] ?? $applicationId),
                'cost_usd' => (float) ($info['cost'] ?? 0),
                'count' => (int) ($info['count'] ?? 0),
            ];
        }

        usort($services, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $services;
    }

    public function buyNumber(string $country, string $service): array
    {
        $data = $this->get('get-number', [
            'country_id' => $country,
            'application_id' => $service,
        ]);

        if (! isset($data['request_id'])) {
            throw new SmsProviderException('SMS-Man: unexpected get-number response');
        }

        return [
            'external_id' => (string) $data['request_id'],
            'phone_number' => isset($data['number']) ? '+' . ltrim((string) $data['number'], '+') : null,
            // get-number doesn't echo back a price; the cost this order
            // is billed at comes from the get-prices lookup the caller
            // (VirtualNumberService) already did before calling buyNumber.
            'cost_usd' => 0.0,
            'operator' => null,
            'expires_at' => null,
            'raw' => $data,
        ];
    }

    public function checkStatus(string $externalId): array
    {
        $response = Http::acceptJson()->timeout(20)->get("{$this->baseUrl}/get-sms", [
            'token' => $this->apiKey,
            'request_id' => $externalId,
        ]);

        $data = $response->json();
        if (! is_array($data)) {
            throw new SmsProviderException('SMS-Man: unexpected get-sms response');
        }

        if (isset($data['error_code'])) {
            if ($data['error_code'] === 'wait_sms') {
                return ['status' => 'waiting', 'sms_code' => null, 'sms_text' => null, 'raw' => $data];
            }

            throw new SmsProviderException('SMS-Man: ' . ($data['error_msg'] ?? $data['error_code']));
        }

        return [
            'status' => isset($data['sms_code']) ? 'received' : 'waiting',
            'sms_code' => $data['sms_code'] ?? null,
            'sms_text' => $data['sms_code'] ?? null,
            'raw' => $data,
        ];
    }

    private function setStatus(string $externalId, string $status): bool
    {
        try {
            $data = $this->get('set-status', ['request_id' => $externalId, 'status' => $status]);

            return (bool) ($data['success'] ?? false);
        } catch (SmsProviderException $e) {
            Log::warning('SMS-Man set-status failed', ['request_id' => $externalId, 'status' => $status, 'message' => $e->getMessage()]);

            return false;
        }
    }

    public function finish(string $externalId): bool
    {
        // "used" = the code was successfully consumed by the customer.
        return $this->setStatus($externalId, 'used');
    }

    public function cancel(string $externalId): bool
    {
        // "reject" releases the number back to the pool without penalty
        // (as opposed to "close", which SMS-Man documents as ending the
        // request after it's already been used).
        return $this->setStatus($externalId, 'reject');
    }
}
