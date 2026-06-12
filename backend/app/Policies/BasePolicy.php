<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\User;

class BasePolicy
{
    protected function isAdmin(User $user): bool
    {
        return $user->rol === UserRole::ADMIN;
    }

    protected function isOperador(User $user): bool
    {
        return $user->rol === UserRole::OPERADOR;
    }
}
