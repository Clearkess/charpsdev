<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

/**
 * Phase 6 (more notification triggers): centralizes the "write an in-app
 * Notification row + best-effort push it to the user's devices" pattern.
 *
 * Before this phase that pattern was only applied once, inconsistently, by
 * CheckoutController on "order placed" (in-app row + push). Several other
 * money-moving / status-changing events fired nothing at all (Paystack wallet
 * deposits, admin wallet credit/debit) or push-only with no in-app record
 * (order status changes in AdminOrderController) — meaning the Notifications
 * page and unread-count badge silently missed most of what actually happens
 * to a user's wallet and orders. This service is the single place that keeps
 * "in-app row" and "push" in sync for every future trigger, instead of each
 * controller hand-rolling (and inevitably forgetting one half of) the pair.
 */
class NotificationService
{
    public function __construct(private readonly WebPushService $webPush)
    {
    }

    /**
     * @param  string  $type  Free-text category surfaced in the Notification
     *                        row (e.g. 'order', 'wallet', 'stock') — the
     *                        `notifications.type` column has no DB-level
     *                        enum/CHECK constraint, so new values never
     *                        require a migration.
     * @param  string  $url   Deep link sent in the push payload only; the
     *                        in-app Notification row has no url column.
     */
    public function notify(User $user, string $type, string $title, string $message, string $url = '/notifications'): void
    {
        Notification::create([
            'user_id' => $user->id,
            'title' => $title,
            'message' => $message,
            'type' => $type,
        ]);

        $this->webPush->sendToUser($user, [
            'title' => $title,
            'body' => $message,
            'url' => $url,
        ]);
    }
}
