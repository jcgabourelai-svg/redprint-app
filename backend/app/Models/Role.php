<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $table = 'roles';

    protected $fillable = [
        'nombre',
        'slug',
        'descripcion',
        'es_sistema',
    ];

    protected function casts(): array
    {
        return [
            'es_sistema' => 'boolean',
        ];
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'permission_role');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'rol_id');
    }

    /**
     * Un rol sistema pasa todos los chequeos de permisos.
     */
    public function tienePermiso(string $clave): bool
    {
        if ($this->es_sistema) {
            return true;
        }

        return $this->permissions()
            ->where('clave', $clave)
            ->exists();
    }
}
