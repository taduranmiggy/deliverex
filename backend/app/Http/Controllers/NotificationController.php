<?php

namespace App\Http\Controllers;

use App\Models\NotificationLog;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            NotificationLog::where('user_id', $request->user()?->id)
                ->latest()
                ->paginate(20)
        );
    }

    public function markRead(NotificationLog $notificationLog, Request $request)
    {
        if ($notificationLog->user_id !== $request->user()?->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $notificationLog->update(['is_read' => true]);

        return response()->json($notificationLog);
    }
}
