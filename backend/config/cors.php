<?php

// App-level override of Laravel's framework default (vendor/laravel/framework/config/cors.php),
// which ships with 'allowed_origins' => ['*'] — wide open to any origin. Phase 10 hardening:
// restrict cross-origin API access to the known frontend origin(s) only.
//
// FRONTEND_URL supports a comma-separated list, e.g.:
//   FRONTEND_URL=https://charpsdev.vercel.app,https://www.charpsdev.com

$frontendUrls = array_filter(array_map(
    'trim',
    explode(',', (string) env('FRONTEND_URL', 'http://localhost:3000'))
));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $frontendUrls,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Bearer-token (Sanctum SPA token) auth is used, not cookie/session auth across
    // origins, so credentials do not need to be supported here.
    'supports_credentials' => false,

];
