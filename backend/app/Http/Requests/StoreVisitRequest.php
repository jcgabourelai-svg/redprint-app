<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cliente_id' => 'required|exists:clients,id',
            'contrato_id' => 'nullable|exists:contracts,id',
            'tipo_visita' => 'required|string|in:LECTURA,MANTENIMIENTO,INSTALACION,RETIRO',
            'fecha_programada' => 'required|date',
            'socio_id' => 'required|exists:users,id',
            'notas' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'cliente_id.required' => 'El cliente es obligatorio',
            'tipo_visita.required' => 'El tipo de visita es obligatorio',
            'fecha_programada.required' => 'La fecha programada es obligatoria',
            'socio_id.required' => 'El socio asignado es obligatorio',
        ];
    }
}
