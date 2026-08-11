<?php

use App\Http\Controllers\Api\Admin\AdminAnalyticsController;
use App\Http\Controllers\Api\Admin\AdminController;
use App\Http\Controllers\Api\Admin\AdminOrderController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\AdminWalletController;
use App\Http\Controllers\Api\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Api\Admin\CouponController as AdminCouponController;
use App\Http\Controllers\Api\Admin\EasylogsProductSyncController;
use App\Http\Controllers\Api\Admin\ProviderController as AdminProviderController;
use App\Http\Controllers\Api\Admin\ServiceController as AdminServiceController;
use App\Http\Controllers\Api\Admin\ServiceProviderRouteController as AdminServiceProviderRouteController;
use App\Http\Controllers\Api\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CouponController;
use App\Http\Controllers\Api\EasylogsWebhookController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PublicSettingController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\VirtualNumberController;
use App\Http\Controllers\Api\WalletController;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::post('/forgot-password', function (Request $request) {
    $request->validate([
        'email' => ['required', 'email'],
    ]);

    $status = Password::sendResetLink($request->only('email'));

    return response()->json([
        'success' => $status === Password::RESET_LINK_SENT,
        'message' => __($status),
    ]);
})->middleware('guest')->name('password.email');

Route::post('/reset-password', function (Request $request) {
    $request->validate([
        'token' => ['required'],
        'email' => ['required', 'email'],
        'password' => ['required', 'confirmed', 'min:8'],
    ]);

    $status = Password::reset(
        $request->only('email', 'password', 'password_confirmation', 'token'),
        function ($user, $password) {
            $user->forceFill([
                'password' => Hash::make($password),
                'remember_token' => Str::random(60),
            ])->save();

            event(new PasswordReset($user));
        }
    );

    return response()->json([
        'success' => $status === Password::PASSWORD_RESET,
        'message' => __($status),
    ]);
})->middleware('guest')->name('password.update');

Route::get('/payment/callback', [PaymentController::class, 'callback']);
Route::post('/payment/webhook', [PaymentController::class, 'webhook']);
Route::post('/webhooks/easylogs', [EasylogsWebhookController::class, 'handle']);

// Public (unauthenticated) allowlisted settings, e.g. the Support page's
// contact email — see PublicSettingController for the exact key allowlist.
Route::get('/settings/public', [PublicSettingController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/email/verify/{id}/{hash}', function (EmailVerificationRequest $request) {
        $request->fulfill();

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully.',
        ]);
    })->middleware('signed')->name('verification.verify');

    Route::post('/email/verification-notification', function (Request $request) {
        $request->user()->sendEmailVerificationNotification();

        return response()->json([
            'success' => true,
            'message' => 'Verification email sent.',
        ]);
    })->middleware('throttle:6,1')->name('verification.send');

    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);

    Route::get('/push/public-key', [PushSubscriptionController::class, 'publicKey']);
    Route::post('/push/subscribe', [PushSubscriptionController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [PushSubscriptionController::class, 'unsubscribe']);

    Route::get('/services', [ServiceController::class, 'index']);
    Route::get('/services/{service}/reviews', [ReviewController::class, 'index']);
    Route::post('/services/{service}/reviews', [ReviewController::class, 'store']);
    Route::get('/categories', [CategoryController::class, 'index']);

    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart', [CartController::class, 'store']);
    Route::put('/cart/{cartItem}', [CartController::class, 'update']);
    Route::delete('/cart/{cartItem}', [CartController::class, 'destroy']);
    Route::delete('/cart', [CartController::class, 'clear']);
    Route::post('/checkout', [CheckoutController::class, 'store']);
    Route::post('/coupons/validate', [CouponController::class, 'validateCode']);

    Route::get('/wallet', [WalletController::class, 'index']);
    Route::post('/wallet/deposit', [WalletController::class, 'deposit']);
    Route::get('/wallet/transactions', [WalletController::class, 'transactions']);

    Route::post('/payment/initialize', [PaymentController::class, 'initialize']);
    Route::get('/payment/verify/{reference}', [PaymentController::class, 'verify']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);

    // Phase 7 (Provider API Sync) follow-up: virtual-number/SMS-OTP
    // rentals from 5SIM / SMS-Man / OnlineSIM. Provider-scoped browsing:
    // pick a provider, then that provider's own countries/services.
    Route::get('/virtual-numbers/providers', [VirtualNumberController::class, 'providers']);
    Route::get('/virtual-numbers/{provider}/countries', [VirtualNumberController::class, 'countries']);
    Route::get('/virtual-numbers/{provider}/services', [VirtualNumberController::class, 'services']);
    Route::get('/virtual-numbers/orders', [VirtualNumberController::class, 'index']);
    Route::post('/virtual-numbers/orders', [VirtualNumberController::class, 'store']);
    Route::get('/virtual-numbers/orders/{virtualNumberOrder}', [VirtualNumberController::class, 'show']);
    Route::post('/virtual-numbers/orders/{virtualNumberOrder}/poll', [VirtualNumberController::class, 'poll']);
    Route::post('/virtual-numbers/orders/{virtualNumberOrder}/cancel', [VirtualNumberController::class, 'cancel']);

    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/dashboard/chart-data', [AdminController::class, 'chartData']);

        Route::get('/analytics/overview', [AdminAnalyticsController::class, 'overview']);

        Route::get('/users', [AdminUserController::class, 'index']);
        Route::get('/users/{user}', [AdminUserController::class, 'show']);
        Route::post('/users/{user}/activate', [AdminUserController::class, 'activate']);
        Route::post('/users/{user}/suspend', [AdminUserController::class, 'suspend']);

        Route::get('/categories', [AdminCategoryController::class, 'index']);
        Route::post('/categories', [AdminCategoryController::class, 'store']);
        Route::put('/categories/{category}', [AdminCategoryController::class, 'update']);
        Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy']);

        Route::get('/services', [AdminServiceController::class, 'index']);
        Route::post('/services', [AdminServiceController::class, 'store']);
        Route::put('/services/{service}', [AdminServiceController::class, 'update']);
        Route::delete('/services/{service}', [AdminServiceController::class, 'destroy']);

        Route::get('/orders', [AdminOrderController::class, 'index']);
        Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
        Route::put('/orders/{order}', [AdminOrderController::class, 'update']);

        Route::get('/wallets', [AdminWalletController::class, 'index']);
        Route::get('/wallets/{user}/transactions', [AdminWalletController::class, 'transactions']);
        Route::post('/wallets/{user}/credit', [AdminWalletController::class, 'credit']);
        Route::post('/wallets/{user}/debit', [AdminWalletController::class, 'debit']);

        Route::get('/providers', [AdminProviderController::class, 'index']);
        Route::get('/providers/health-summary', [AdminProviderController::class, 'healthSummary']);
        Route::post('/providers', [AdminProviderController::class, 'store']);
        Route::put('/providers/{provider}', [AdminProviderController::class, 'update']);
        Route::delete('/providers/{provider}', [AdminProviderController::class, 'destroy']);
        Route::post('/providers/{provider}/test', [AdminProviderController::class, 'test']);
        Route::post('/providers/{provider}/health-check', [AdminProviderController::class, 'healthCheck']);
        Route::get('/providers/{provider}/health', [AdminProviderController::class, 'health']);
        Route::get('/providers/{provider}/services', [AdminServiceProviderRouteController::class, 'servicesForProvider']);
        Route::post('/providers/{provider}/easylogs/products/sync', [EasylogsProductSyncController::class, 'sync']);

        // Provider Router (Option B): per-service routing chain (the
        // "Routing editor" UI's backing endpoints). Deliberately nested
        // under /admin/services/{service}/providers rather than a
        // top-level resource — every one of these operations is always
        // scoped to exactly one service's chain.
        Route::get('/services/{service}/providers', [AdminServiceProviderRouteController::class, 'index']);
        Route::post('/services/{service}/providers', [AdminServiceProviderRouteController::class, 'store']);
        Route::put('/services/{service}/providers/{route}', [AdminServiceProviderRouteController::class, 'update']);
        Route::delete('/services/{service}/providers/{route}', [AdminServiceProviderRouteController::class, 'destroy']);
        Route::post('/services/{service}/providers/reorder', [AdminServiceProviderRouteController::class, 'reorder']);

        Route::get('/coupons', [AdminCouponController::class, 'index']);
        Route::post('/coupons', [AdminCouponController::class, 'store']);
        Route::put('/coupons/{coupon}', [AdminCouponController::class, 'update']);
        Route::delete('/coupons/{coupon}', [AdminCouponController::class, 'destroy']);

        Route::get('/settings', [AdminSettingController::class, 'index']);
        Route::put('/settings', [AdminSettingController::class, 'update']);
    });
});
