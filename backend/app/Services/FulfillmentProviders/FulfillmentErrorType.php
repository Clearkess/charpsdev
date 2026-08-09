<?php

namespace App\Services\FulfillmentProviders;

/**
 * Provider Router (Option A) — classifies why a FulfillmentProviderInterface
 * call failed, so ProviderRouter knows whether it's safe to try the next
 * provider in the chain. Mirrors the "do NOT fail over blindly" distinction
 * from the original proposal:
 *
 * - Retryable: timeout, connection failure, DNS failure, HTTP 502/503/504,
 *   "provider temporarily unavailable" — the request almost certainly never
 *   reached (or was never acted on by) the upstream, so trying the next
 *   provider carries no double-fulfilment risk.
 * - NonRetryable: insufficient provider balance, invalid customer/recipient
 *   number, invalid service, transaction rejected, transaction already
 *   exists — the upstream DEFINITIVELY did not fulfil, but the failure is
 *   about the request itself (bad balance, bad input), which will fail
 *   identically on every other provider too. Stop, don't cascade.
 * - Ambiguous: request timed out or returned an unclear response AFTER
 *   possibly reaching the upstream — we genuinely don't know if it
 *   fulfilled. ProviderRouter MUST check the original provider's own
 *   transaction status before deciding to fail over, to avoid a customer
 *   receiving the same order fulfilled twice (e.g. VTpass times out but
 *   actually delivered, then Flutterwave delivers again).
 */
enum FulfillmentErrorType: string
{
    case Retryable = 'retryable';
    case NonRetryable = 'non_retryable';
    case Ambiguous = 'ambiguous';
}
