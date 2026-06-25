<?php

namespace App\Policies;

use App\Models\User;

class BasePolicy
{
    protected function isAdmin(User $user): bool
    {
        return $user->isAdmin();
    }

    protected function isOperador(User $user): bool
    {
        return $user->isOperador();
    }
}
