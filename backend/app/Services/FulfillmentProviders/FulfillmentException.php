<?php

namespace App\Services\FulfillmentProviders;

use RuntimeException;
use Throwable;

/**
 * Thrown by any FulfillmentProviderInterface method when the upstream
 * provider fails to fulfil a request. Always carries a FulfillmentErrorType
 * so ProviderRouter can decide whether it's safe to fail over to the next
 * provider in the chain, or must stop (or check status first) instead of
 * blindly cascading. Mirrors SmsProviderException's role at the controller
 * boundary, but with the added error-type classification the Provider
 * Router proposal calls out as the critical "don't fail over blindly" rule.
 */
class FulfillmentException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly FulfillmentErrorType $errorType,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
