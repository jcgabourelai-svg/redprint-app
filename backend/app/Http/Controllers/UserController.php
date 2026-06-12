<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = User::query()
            ->when($request->search, fn($q, $s) => $q->where('nombre', 'ilike', "%{$s}%"))
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return UserResource::collection($users);
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['contrasena_hash'] = Hash::make($data['contrasena']);
        unset($data['contrasena']);

        $user = User::create($data);

        return response()->json(new UserResource($user), 201);
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        $user->update($request->validated());
        return new UserResource($user);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $tempPassword = 'Temp' . rand(1000, 9999);
        $user->update(['contrasena_hash' => Hash::make($tempPassword)]);

        return response()->json([
            'message' => 'Contrasena restablecida',
            'temp_password' => $tempPassword,
        ]);
    }
}
