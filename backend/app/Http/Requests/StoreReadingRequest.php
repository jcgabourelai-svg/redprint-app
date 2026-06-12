<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReadingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'visita_id' => 'required|exists:visits,id',
            'impresora_id' => 'required|exists:printers,id',
            'contrato_id' => 'nullable|exists:contracts,id',
            'fecha' => 'required|date',
            'valor_contador' => 'required|integer|min:0',
            'foto_evidencia' => 'nullable|string',
            'justificacion_anomalia' => 'nullable|string',
            'ubicacion_lat' => 'nullable|numeric',
            'ubicacion_lng' => 'nullable|numeric',
        ];
    }

    public function messages(): array
    {
        return [
            'visita_id.required' => 'La visita es obligatoria',
            'impresora_id.required' => 'La impresora es obligatoria',
            'fecha.required' => 'La fecha es obligatoria',
            'valor_contador.required' => 'El valor del contador es obligatorio',
            'valor_contador.min' => 'El valor del contador no puede ser negativo',
        ];
    }
}
