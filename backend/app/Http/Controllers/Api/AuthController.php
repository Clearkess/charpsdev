<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use App\Models\Wallet;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    use ApiResponse;

    public function register(RegisterRequest $request)
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'active' => true,
        ]);

        Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'currency' => 'NGN']
        );

        $user->sendEmailVerificationNotification();

        return $this->success(
            $user->load('wallet'),
            'Registration successful. Please verify your email.',
            201
        );
    }

    public function login(LoginRequest $request)
    {
        $credentials = $request->validated();

        if (! Auth::attempt($credentials)) {
            return $this->error('Invalid credentials', 401);
        }

        /** @var User $user */
        $user = Auth::user();

        if ($user->active === false) {
            Auth::logout();
            return $this->error('Your account has been suspended.', 403);
        }

        $token = $user->createToken('api')->plainTextToken;

        return $this->success([
            'token' => $token,
            'user' => $user->load('wallet'),
        ], 'Login successful');
    }

    public function me(Request $request)
    {
        return $this->success(
            $request->user()->load('wallet'),
            'User retrieved successfully.'
        );
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return $this->success(
            null,
            'Logged out successfully.'
        );
    }
}
