<?php

namespace App\Services\SmsProviders;

use RuntimeException;

/**
 * Thrown by any SmsProviderInterface method when the upstream provider
 * rejects a request (e.g. "not enough balance", "no free numbers",
 * "order not found") or returns a shape VirtualNumberService can't use.
 * Caught at the controller boundary and turned into a 4xx JSON response —
 * never lets a raw provider error string reach the customer unfiltered.
 */
class SmsProviderException extends RuntimeException
{
}
