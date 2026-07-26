<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()
            ->notifications()
            ->latest()
            ->paginate(20);
    }

    public function markAsRead($id, Request $request)
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->update([
            'is_read' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
        ]);
    }

    public function unreadCount(Request $request)
    {
        return response()->json([
            'count' => $request->user()
                ->notifications()
                ->where('is_read', false)
                ->count(),
        ]);
    }
}
