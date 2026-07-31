<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    /**
     * Seeds the fixed set of keys the app actually reads (see
     * Setting::get() call sites, e.g. DepositRequest). Idempotent
     * (updateOrCreate) so re-running this against production never
     * clobbers a value an admin already changed via the Settings page.
     */
    public function run(): void
    {
        $defaults = [
            [
                'key' => 'site_name',
                'value' => 'CharpsDev',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Site name',
            ],
            [
                'key' => 'support_email',
                'value' => 'hello@charpsdev.com',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Support email',
            ],
            [
                'key' => 'min_deposit_amount',
                'value' => '100',
                'type' => 'integer',
                'group' => 'wallet',
                'label' => 'Minimum deposit amount (NGN)',
            ],
            [
                'key' => 'max_deposit_amount',
                'value' => '5000000',
                'type' => 'integer',
                'group' => 'wallet',
                'label' => 'Maximum deposit amount (NGN)',
            ],
            [
                'key' => 'maintenance_mode',
                'value' => '0',
                'type' => 'boolean',
                'group' => 'general',
                'label' => 'Maintenance mode',
            ],
        ];

        foreach ($defaults as $setting) {
            Setting::firstOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
