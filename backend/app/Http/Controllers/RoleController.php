<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoleRequest;
use App\Http\Requests\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $query = Role::query()->with('permissions');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('nombre', 'ilike', "%{$search}%")
                    ->orWhere('slug', 'ilike', "%{$search}%");
            });
        }

        $roles = $query->orderBy('es_sistema', 'desc')->orderBy('nombre')->get();

        return RoleResource::collection($roles);
    }

    public function show(Role $role): RoleResource
    {
        return new RoleResource($role->load('permissions'));
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $data = $request->validated();
        $permisos = $this->idsDeClaves($data['permisos'] ?? []);

        $role = Role::create([
            'nombre' => $data['nombre'],
            'slug' => Str::slug($data['nombre']) ?: Str::random(8),
            'descripcion' => $data['descripcion'] ?? null,
            'es_sistema' => false,
        ]);

        $role->permissions()->sync($permisos);

        return response()->json(new RoleResource($role->load('permissions')), 201);
    }

    public function update(UpdateRoleRequest $request, Role $role): RoleResource
    {
        if ($role->es_sistema && $request->has('permisos')) {
            // No se pueden alterar los permisos de un rol sistema (su bypass ya los cubre).
            abort(422, 'No se pueden modificar los permisos de un rol sistema');
        }

        $data = $request->validated();

        if (array_key_exists('nombre', $data) && !$role->es_sistema) {
            $role->nombre = $data['nombre'];
            $role->slug = Str::slug($data['nombre']) ?: $role->slug;
        }

        if (array_key_exists('descripcion', $data)) {
            $role->descripcion = $data['descripcion'];
        }

        $role->save();

        if (!$role->es_sistema && array_key_exists('permisos', $data)) {
            $role->permissions()->sync($this->idsDeClaves($data['permisos']));
        }

        return new RoleResource($role->load('permissions'));
    }

    public function destroy(Role $role): JsonResponse
    {
        if ($role->es_sistema) {
            abort(422, 'No se puede eliminar un rol sistema');
        }

        if ($role->users()->exists()) {
            abort(422, 'No se puede eliminar un rol con usuarios asignados');
        }

        $role->delete();

        return response()->json(['message' => 'Rol eliminado']);
    }

    /**
     * Convierte claves de permiso (string) en IDs de la tabla permissions.
     */
    private function idsDeClaves(array $claves): array
    {
        if (empty($claves)) {
            return [];
        }

        return Permission::whereIn('clave', $claves)->pluck('id')->all();
    }
}
