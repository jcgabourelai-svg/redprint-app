<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImportCfdiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'archivos' => 'required|array',
            'archivos.*' => 'file|mimes:xml|max:2048',
        ];
    }

    public function messages(): array
    {
        return [
            'archivos.required' => 'Debes seleccionar al menos un archivo XML.',
            'archivos.array' => 'El formato de archivos no es valido.',
            'archivos.*.file' => 'Cada elemento debe ser un archivo.',
            'archivos.*.mimes' => 'Solo se permiten archivos XML.',
            'archivos.*.max' => 'Cada archivo no debe superar los 2 MB.',
        ];
    }
}
