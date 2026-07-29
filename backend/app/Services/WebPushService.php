<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

class WebPushService
{
    protected ?WebPush $webPush = null;

    protected function client(): ?WebPush
    {
        if ($this->webPush) {
            return $this->webPush;
        }

        $publicKey = config('webpush.vapid_public_key');
        $privateKey = config('webpush.vapid_private_key');

        if (! $publicKey || ! $privateKey) {
            return null;
        }

        $this->webPush = new WebPush([
            'VAPID' => [
                'subject' => config('webpush.vapid_subject'),
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ],
        ]);

        return $this->webPush;
    }

    /**
     * Send a push notification payload to every subscribed device of a user.
     *
     * @param  array<string, mixed>  $payload
     */
    public function sendToUser(User $user, array $payload): void
    {
        $client = $this->client();

        if (! $client) {
            return;
        }

        $subscriptions = $user->pushSubscriptions()->get();

        if ($subscriptions->isEmpty()) {
            return;
        }

        $body = json_encode($payload);

        foreach ($subscriptions as $subscription) {
            $client->queueNotification(
                Subscription::create([
                    'endpoint' => $subscription->endpoint,
                    'publicKey' => $subscription->public_key,
                    'authToken' => $subscription->auth_token,
                    'contentEncoding' => $subscription->content_encoding,
                ]),
                $body,
            );
        }

        try {
            foreach ($client->flush() as $report) {
                if (! $report->isSuccess() && $report->isSubscriptionExpired()) {
                    PushSubscription::query()
                        ->where('endpoint_hash', hash('sha256', $report->getEndpoint()))
                        ->delete();
                }
            }
        } catch (Throwable $e) {
            report($e);
        }
    }
}
