<?php

namespace App\Http\Controllers;

use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Traits\Sortable;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use Sortable;

    public function index(Request $request)
    {
        $query = Notification::where('usuario_id', $request->user()->id)
            ->when($request->leida !== null, fn($q, $l) => $q->where('leida', $l))
            ->when($request->tipo, fn($q, $t) => $q->where('tipo', $t));

        $this->applySorting($query, $request, [
            'id', 'created_at', 'leida',
        ], 'created_at', 'desc');

        $notifications = $query->paginate($request->per_page ?? 15);

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
