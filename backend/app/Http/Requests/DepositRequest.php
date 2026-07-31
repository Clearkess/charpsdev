<?php

namespace App\Http\Requests;

use App\Models\Setting;
use Illuminate\Foundation\Http\FormRequest;

class DepositRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Phase 4 (Providers/Coupons/Settings): min/max deposit bounds are
        // now admin-configurable via the Settings page instead of being
        // hardcoded, falling back to the same 100 / 5,000,000 NGN defaults
        // Phase 2 introduced if the settings rows are somehow missing
        // (e.g. a fresh DB that hasn't run SettingsSeeder yet).
        $min = Setting::get('min_deposit_amount', 100);
        $max = Setting::get('max_deposit_amount', 5000000);

        return [
            'amount' => ['required', 'numeric', "min:{$min}", "max:{$max}"],
        ];
    }
}
