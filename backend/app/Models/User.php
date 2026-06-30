<?php

namespace App\Models;

use App\Traits\Searchable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, Searchable;

    protected $table = 'users';

    protected $fillable = [
        'nombre',
        'correo',
        'contrasena_hash',
        'telefono',
        'rol_id',
        'activo',
    ];

    protected $hidden = [
        'contrasena_hash',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'contrasena_hash' => 'hashed',
            'activo' => 'boolean',
            'ultimo_acceso' => 'datetime',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function scopeAdministradores($query)
    {
        return $query->whereHas('role', fn ($q) => $q->where('slug', 'administrador'));
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'rol_id');
    }

    /**
     * Es admin si su rol es sistema (bypass total de permisos).
     * Mantiene compatibilidad con authorize() y el frontend useIsAdmin().
     */
    public function isAdmin(): bool
    {
        return (bool) ($this->role?->es_sistema);
    }

    public function isOperador(): bool
    {
        return $this->role?->slug === 'operador';
    }

    public function getAuthPassword(): string
    {
        return $this->contrasena_hash;
    }

    /**
     * Lista de claves de permiso del usuario (cacheada por request).
     */
    public function permisos(): array
    {
        if (isset($this->permisosCache)) {
            return $this->permisosCache;
        }

        if ($this->isAdmin()) {
            $todas = [];
            foreach (config('permisos') as $permisos) {
                foreach ($permisos as $permiso) {
                    $todas[] = $permiso['clave'];
                }
            }

            return $this->permisosCache = $todas;
        }

        return $this->permisosCache = $this->role
            ? $this->role->permissions()->pluck('permissions.clave')->all()
            : [];
    }

    public function tienePermiso(string $clave): bool
    {
        if ($this->isAdmin()) {
            return true;
        }

        return in_array($clave, $this->permisos(), true);
    }
}
