<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    /**
     * Return the public VAPID key so the frontend can subscribe the browser.
     */
    public function publicKey()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'publicKey' => config('webpush.vapid_public_key'),
            ],
        ]);
    }

    /**
     * Store (or refresh) a push subscription for the authenticated user.
     */
    public function subscribe(Request $request)
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'contentEncoding' => ['nullable', 'string', 'in:aesgcm,aes128gcm'],
        ]);

        $request->user()->pushSubscriptions()->updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['contentEncoding'] ?? 'aes128gcm',
            ],
        );

        return response()->json([
            'success' => true,
            'message' => 'Subscribed to push notifications.',
        ]);
    }

    /**
     * Remove a push subscription for the authenticated user.
     */
    public function unsubscribe(Request $request)
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string'],
        ]);

        $request->user()->pushSubscriptions()
            ->where('endpoint_hash', hash('sha256', $data['endpoint']))
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Unsubscribed from push notifications.',
        ]);
    }
}
