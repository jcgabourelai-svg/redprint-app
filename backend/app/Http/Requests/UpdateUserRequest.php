<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'nombre' => 'sometimes|string|max:255',
            'correo' => 'sometimes|email|unique:users,correo,' . $this->user->id,
            'telefono' => 'nullable|string|max:30',
            'rol' => 'sometimes|string|in:ADMIN,OPERADOR',
            'activo' => 'sometimes|boolean',
        ];
    }
}
