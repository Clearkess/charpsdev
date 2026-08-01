<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * Apply a baseline set of security response headers to every response.
     *
     * This is a JSON API (Sanctum bearer tokens, no server-rendered HTML views
     * to frame or sniff), so the headers below are conservative, low-risk
     * additions rather than a full CSP — the goal is defense-in-depth against
     * MIME-sniffing, clickjacking of any accidental HTML error page, and to
     * stop referrer leakage, without risking breakage of legitimate API use.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        if ($request->isSecure()) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains'
            );
        }

        return $response;
    }
}
