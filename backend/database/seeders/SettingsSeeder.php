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
            // Virtual numbers (5SIM / SMS-Man / OnlineSIM): all three price
            // in USD while the wallet is NGN-only, so every purchase needs
            // an FX rate; markup is CharpsDev's margin on top of the raw
            // provider cost. Both are snapshotted onto the order at
            // purchase time (see VirtualNumberService) so a later admin
            // edit here never changes what a past order already charged.
            [
                'key' => 'virtual_number_markup_percent',
                'value' => '20',
                'type' => 'float',
                'group' => 'virtual_numbers',
                'label' => 'Virtual number markup (%)',
            ],
            [
                'key' => 'usd_to_ngn_rate',
                'value' => '1600',
                'type' => 'float',
                'group' => 'virtual_numbers',
                'label' => 'USD to NGN exchange rate',
            ],
        ];

        foreach ($defaults as $setting) {
            Setting::firstOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
