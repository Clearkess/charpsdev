<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Traits\ApiResponse;

/**
 * Read-only, unauthenticated subset of Setting::get() for values the
 * public-facing app needs to render (e.g. the Support page's contact
 * email). Deliberately a hard-coded allowlist, never a passthrough of
 * every Setting row — most settings (deposit bounds, virtual-number
 * markup/FX rate) are internal business config that should never be
 * exposed to an unauthenticated client.
 */
class PublicSettingController extends Controller
{
    use ApiResponse;

    private const ALLOWED_KEYS = [
        'site_name',
        'support_email',
    ];

    public function index()
    {
        $settings = collect(self::ALLOWED_KEYS)
            ->mapWithKeys(fn (string $key) => [$key => Setting::get($key)]);

        return $this->success($settings, 'Settings retrieved successfully.');
    }
}
