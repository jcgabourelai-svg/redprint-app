<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'razon_social' => 'required|string|max:255',
            'rfc' => 'nullable|string|max:20',
            'nombre_contacto' => 'required|string|max:255',
            'telefono' => 'required|string|max:30',
            'correo' => 'nullable|email|max:255',
            'direccion_instalacion' => 'required|string',
            'notas' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'razon_social.required' => 'La razon social es obligatoria',
            'nombre_contacto.required' => 'El nombre de contacto es obligatorio',
            'telefono.required' => 'El telefono es obligatorio',
            'direccion_instalacion.required' => 'La direccion de instalacion es obligatoria',
            'correo.email' => 'El correo debe ser una direccion valida',
        ];
    }
}
