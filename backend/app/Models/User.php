<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'nombre',
        'correo',
        'contrasena_hash',
        'telefono',
        'rol',
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
            'rol' => UserRole::class,
            'activo' => 'boolean',
            'ultimo_acceso' => 'datetime',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->rol === UserRole::ADMIN;
    }

    public function isOperador(): bool
    {
        return $this->rol === UserRole::OPERADOR;
    }

    public function getAuthPassword(): string
    {
        return $this->contrasena_hash;
    }
}
