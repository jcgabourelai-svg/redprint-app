<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin() || $this->user()->tienePermiso('sistema.usuarios');
    }

    public function rules(): array
    {
        return [
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string|max:1000',
            'permisos' => 'sometimes|array',
            'permisos.*' => ['string', Rule::in($this->clavesValidas())],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre es obligatorio',
            'permisos.array' => 'Los permisos deben ser una lista',
            'permisos.*.in' => 'Uno o mas permisos no son validos',
        ];
    }

    /**
     * @return string[]
     */
    private function clavesValidas(): array
    {
        $claves = [];
        foreach (config('permisos') as $permisos) {
            foreach ($permisos as $permiso) {
                $claves[] = $permiso['clave'];
            }
        }

        return $claves;
    }
}
