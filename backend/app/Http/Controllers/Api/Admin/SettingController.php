<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Setting::orderBy('group')->orderBy('key')->get(),
        ]);
    }

    /**
     * Bulk upsert: { settings: [{ key, value }, ...] }. Only keys that
     * already exist (created by the DemoDataSeeder/migration seed step)
     * can be updated here — this is deliberately not a free-form
     * key-value store an admin can invent arbitrary keys into, since
     * `Setting::get()` call sites elsewhere in the codebase (e.g.
     * DepositRequest) expect a fixed, known set of keys/types.
     */
    public function update(Request $request)
    {
        $data = $request->validate([
            'settings' => 'required|array|min:1',
            'settings.*.key' => ['required', 'string', Rule::exists('settings', 'key')],
            'settings.*.value' => 'required',
        ]);

        foreach ($data['settings'] as $item) {
            $setting = Setting::where('key', $item['key'])->first();
            $setting->update(['value' => (string) $item['value']]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Settings updated successfully.',
            'data' => Setting::orderBy('group')->orderBy('key')->get(),
        ]);
    }
}
