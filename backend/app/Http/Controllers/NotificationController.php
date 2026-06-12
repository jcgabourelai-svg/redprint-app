<?php

namespace App\Http\Controllers;

use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifications = Notification::where('usuario_id', $request->user()->id)
            ->when($request->leida !== null, fn($q, $l) => $q->where('leida', $l))
            ->when($request->tipo, fn($q, $t) => $q->where('tipo', $t))
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return NotificationResource::collection($notifications);
    }

    public function markAsRead(Notification $notification)
    {
        $notification->update(['leida' => true]);
        return new NotificationResource($notification);
    }

    public function markAllAsRead(Request $request)
    {
        Notification::where('usuario_id', $request->user()->id)
            ->where('leida', false)
            ->update(['leida' => true]);

        return response()->json(['message' => 'Todas las notificaciones marcadas como leidas']);
    }
}
