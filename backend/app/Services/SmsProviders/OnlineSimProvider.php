<?php

namespace App\Services\SmsProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * OnlineSIM API (https://onlinesim.io/api), `apikey` query param auth.
 * Verified live during integration for getBalance.php and getTariffs.php
 * (real balance + real country/service/USD-price data came back). The
 * buy/status/finish/cancel endpoints below (getNum, getState,
 * setOperationOk, setOperationRevise) were confirmed reachable and
 * correctly *rejecting* invalid input (e.g. "WARNING_LOW_BALANCE" for a
 * real buy attempt at $0 balance, "ERROR_NO_OPERATIONS" for a fake tzid)
 * per OnlineSIM's own OpenAPI docs, but the happy-path success response
 * shape for getNum/getState was not observed live (this account has
 * $0.000 balance, so a real purchase can't be completed to see it) — the
 * parsing below is written from the documented field names and should be
 * spot-checked against a real order once the account is funded.
 */
class OnlineSimProvider implements SmsProviderInterface
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = 'https://onlinesim.io/api',
    ) {
    }

    private function get(string $path, array $query = []): array
    {
        $response = Http::acceptJson()->timeout(20)->get("{$this->baseUrl}/{$path}", array_merge([
            'apikey' => $this->apiKey,
            'lang' => 'en',
        ], $query));

        $data = $response->json();

        if (! is_array($data)) {
            throw new SmsProviderException('OnlineSIM: unexpected response from ' . $path);
        }

        return $data;
    }

    /**
     * OnlineSIM error responses share the shape {"response": "ERROR_..."}
     * or {"response":"0", ...}. Success responses always have a truthy,
     * non-"ERROR_*" `response` value (usually the string "1").
     */
    private function assertSuccess(array $data, string $context): array
    {
        $response = (string) ($data['response'] ?? '');

        if ($response === '' || str_starts_with($response, 'ERROR') || str_starts_with($response, 'WARNING') || $response === '0') {
            throw new SmsProviderException("OnlineSIM ({$context}): {$response}");
        }

        return $data;
    }

    public function getBalance(): float
    {
        $data = $this->assertSuccess($this->get('getBalance.php'), 'getBalance');

        return (float) ($data['balance'] ?? 0);
    }

    /**
     * `country` in this app's virtual-number feature is OnlineSIM's E.164
     * dialling code (e.g. "1" for USA/Canada NANP, "44" for UK) — that's
     * what both this list and getNum.php's `country` parameter use, per
     * OnlineSIM's docs. Uses the dedicated v1 endpoint (verified live:
     * returned a real 100+ entry {dial_code: name} map) rather than
     * scraping it out of getTariffs.
     */
    public function listCountries(): array
    {
        $response = Http::acceptJson()->timeout(20)->get("{$this->baseUrl}/v1/info/countries", ['lang' => 'en']);
        $data = $response->json();

        if (! is_array($data) || ! isset($data['countries']) || ! is_array($data['countries'])) {
            throw new SmsProviderException('OnlineSIM: unexpected countries response');
        }

        $countries = [];
        foreach ($data['countries'] as $dialCode => $name) {
            $countries[] = [
                'code' => (string) $dialCode,
                'name' => ucwords(str_replace(['_', '-'], ' ', (string) $name)),
            ];
        }

        usort($countries, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $countries;
    }

    /**
     * `getTariffs.php?filter_country={dialCode}` conveniently returns
     * that country's services + live USD prices in one call (verified
     * live: real prices for USA came back, e.g. WhatsApp $5.50, Telegram
     * $4.80). Each `services` entry's `slug` is the code buyNumber()
     * below passes straight through as `service` to getNum.php.
     */
    public function listServices(string $country): array
    {
        $data = $this->get('getTariffs.php', ['filter_country' => $country]);

        if (! isset($data['services']) || ! is_array($data['services'])) {
            return [];
        }

        $services = [];
        foreach ($data['services'] as $entry) {
            if (! is_array($entry) || empty($entry['slug'])) {
                continue;
            }
            $services[] = [
                'code' => (string) $entry['slug'],
                'name' => (string) ($entry['service'] ?? $entry['slug']),
                'cost_usd' => (float) ($entry['price'] ?? 0),
                'count' => (int) ($entry['count'] ?? 0),
            ];
        }

        usort($services, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $services;
    }

    public function buyNumber(string $country, string $service): array
    {
        $data = $this->assertSuccess(
            $this->get('getNum.php', ['service' => $service, 'country' => $country, 'number' => 'true']),
            'getNum'
        );

        $externalId = $data['tzid'] ?? $data['tz_id'] ?? null;
        if (! $externalId) {
            throw new SmsProviderException('OnlineSIM: getNum succeeded but no tzid in response');
        }

        return [
            'external_id' => (string) $externalId,
            'phone_number' => isset($data['number']) ? '+' . ltrim((string) $data['number'], '+') : null,
            'cost_usd' => (float) ($data['price'] ?? $data['cost'] ?? 0),
            'operator' => null,
            'expires_at' => null,
            'raw' => $data,
        ];
    }

    /**
     * OnlineSIM's getState.php error codes double as its non-final
     * states in practice (e.g. a fresh order with no SMS yet returns an
     * error-shaped "no messages" response rather than a distinct
     * "waiting" status) — mapped to `waiting` here rather than treated
     * as a hard failure, since a genuinely fatal problem (wrong tzid,
     * wrong key) still throws via a different path below.
     */
    public function checkStatus(string $externalId): array
    {
        $data = $this->get('getState.php', [
            'tzid' => $externalId,
            'message_to_code' => 1,
            'msg_list' => 1,
        ]);

        // Success: an array of operation objects (per OnlineSIM docs);
        // failure: a single {"response": "ERROR_..."} object.
        $operation = null;
        if (array_is_list($data) && isset($data[0]) && is_array($data[0])) {
            $operation = $data[0];
        } elseif (isset($data['response']) && is_string($data['response']) && str_starts_with($data['response'], 'ERROR')) {
            if ($data['response'] === 'ERROR_WRONG_TZID') {
                throw new SmsProviderException('OnlineSIM: order not found');
            }

            // ERROR_NO_OPERATIONS and similar just mean "nothing yet".
            return ['status' => 'waiting', 'sms_code' => null, 'sms_text' => null, 'raw' => $data];
        } elseif (isset($data['response']) && is_array($data['response'])) {
            $operation = $data['response'];
        }

        if (! $operation) {
            return ['status' => 'waiting', 'sms_code' => null, 'sms_text' => null, 'raw' => $data];
        }

        $state = strtoupper((string) ($operation['response'] ?? $operation['state'] ?? ''));
        $code = $operation['msg'] ?? $operation['code'] ?? null;

        $status = match (true) {
            str_contains($state, 'CANCEL') => 'cancelled',
            str_contains($state, 'REJECT') => 'failed',
            $code !== null && $code !== '' => 'received',
            default => 'waiting',
        };

        return [
            'status' => $status,
            'sms_code' => $code,
            'sms_text' => $operation['text'] ?? ($code !== null ? (string) $code : null),
            'raw' => $data,
        ];
    }

    public function finish(string $externalId): bool
    {
        try {
            $this->assertSuccess($this->get('setOperationOk.php', ['tzid' => $externalId]), 'setOperationOk');

            return true;
        } catch (SmsProviderException $e) {
            Log::warning('OnlineSIM finish() failed', ['tzid' => $externalId, 'message' => $e->getMessage()]);

            return false;
        }
    }

    public function cancel(string $externalId): bool
    {
        // setOperationRevise.php confirmed live: returns
        // {"tzid":..., "response":"1"} even for an unknown tzid, so this
        // is effectively always a success from the caller's perspective.
        $data = $this->get('setOperationRevise.php', ['tzid' => $externalId]);

        return (string) ($data['response'] ?? '') === '1';
    }
}
