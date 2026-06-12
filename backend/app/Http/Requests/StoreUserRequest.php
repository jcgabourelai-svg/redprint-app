<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'nombre' => 'required|string|max:255',
            'correo' => 'required|email|unique:users,correo',
            'contrasena' => 'required|string|min:6',
            'telefono' => 'nullable|string|max:30',
            'rol' => 'required|string|in:ADMIN,OPERADOR',
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre es obligatorio',
            'correo.required' => 'El correo es obligatorio',
            'correo.email' => 'El correo debe ser una direccion valida',
            'correo.unique' => 'El correo ya esta en uso',
            'contrasena.required' => 'La contrasena es obligatoria',
            'contrasena.min' => 'La contrasena debe tener al menos 6 caracteres',
            'rol.required' => 'El rol es obligatorio',
        ];
    }
}
