<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
        ->withMiddleware(function (Middleware $middleware): void {
            $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/login');

            // Railway terminates TLS and proxies every request through its own edge,
            // so the app has no way to see the real client IP unless it trusts the
            // X-Forwarded-* headers from that edge. Without this, $request->ip() (used
            // by the Phase 10 login/register rate limiters and by any future IP-based
            // logic) returns Railway's internal proxy address instead of the real
            // client IP — which is either unstable across requests (splitting one
            // attacker's requests across many "IPs", defeating the limiter) or, worse,
            // identical for every visitor (merging all users into one shared bucket).
            // Trusting all proxies is the standard posture here since Railway's edge
            // IS the trust boundary — nothing sits between it and the internet.
            $middleware->trustProxies(at: '*');

            $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

            $middleware->alias([
                'admin' => \App\Http\Middleware\AdminMiddleware::class,
                'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
                'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            ]);
        })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })
    ->create();
