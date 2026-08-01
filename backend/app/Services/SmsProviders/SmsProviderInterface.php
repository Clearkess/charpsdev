<?php

namespace App\Services\SmsProviders;

/**
 * Unified contract over the three virtual-number/SMS-OTP rental providers
 * (5SIM, SMS-Man, OnlineSIM). Each provider uses its own country/service
 * coding scheme (English-word slugs, numeric ids, or E.164 dialling
 * codes) — this interface deliberately does NOT try to normalize those
 * into a shared taxonomy. Callers pass through whatever `country`/
 * `service` values that provider's own listCountries()/listServices()
 * returned, so browsing is always "provider-scoped" (pick a provider tab
 * first, then browse its native catalog) rather than a unified
 * cross-provider comparison.
 */
interface SmsProviderInterface
{
    /**
     * Current balance on the provider account, in that provider's native
     * currency (all three of 5SIM/SMS-Man/OnlineSIM price in USD).
     */
    public function getBalance(): float;

    /**
     * @return array<int, array{code: string, name: string}>
     */
    public function listCountries(): array;

    /**
     * @return array<int, array{code: string, name: string, cost_usd: float, count: int}>
     */
    public function listServices(string $country): array;

    /**
     * Rents a number for the given country/service. Throws
     * SmsProviderException on failure (insufficient balance, no numbers
     * available, etc.) so VirtualNumberService can roll back the wallet
     * debit it already reserved.
     *
     * @return array{external_id: string, phone_number: ?string, cost_usd: float, operator: ?string, expires_at: ?string, raw: array}
     */
    public function buyNumber(string $country, string $service): array;

    /**
     * Polls the provider for the current state of a rented number.
     *
     * @return array{status: string, sms_code: ?string, sms_text: ?string, raw: array}
     *
     * `status` is one of: waiting, received, cancelled, expired, failed.
     */
    public function checkStatus(string $externalId): array;

    /**
     * Marks a completed order as finished (releases the number back to
     * the provider's pool on their side). Returns false rather than
     * throwing on a "not found"/already-finished response, since that's
     * an idempotent no-op from our perspective.
     */
    public function finish(string $externalId): bool;

    /**
     * Cancels an order (e.g. no SMS arrived in time), which the caller
     * uses as the trigger to refund the customer's wallet.
     */
    public function cancel(string $externalId): bool;
}
