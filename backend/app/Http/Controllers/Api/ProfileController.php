<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    use ApiResponse;

    public function show(Request $request)
    {
        return $this->success(
            $request->user()->load('wallet'),
            'Profile retrieved successfully.'
        );
    }

    public function update(UpdateProfileRequest $request)
    {
        $user = $request->user();
        $user->update($request->validated());

        return $this->success(
            $user->fresh(),
            'Profile updated successfully.'
        );
    }

    /**
     * Phase 9 (user-facing features): change password while logged in.
     * Before this, the only way to change a password was the forgot/reset
     * flow (logging out, requesting an email, resetting) — there was no
     * in-app way to do it while authenticated. Mirrors RegisterRequest's
     * `min:8` rule for consistency. `current_password` is Laravel's built-in
     * rule that re-checks the hash against the authenticated user's own
     * password, so this never accidentally lets someone else's session
     * change a password without knowing the current one.
     */
    public function updatePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $request->user()->update([
            'password' => Hash::make($data['password']),
        ]);

        return $this->success(null, 'Password updated successfully.');
    }
}
