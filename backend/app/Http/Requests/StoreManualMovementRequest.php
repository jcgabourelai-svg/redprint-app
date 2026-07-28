<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreManualMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo_movimiento' => 'required|in:ENTRADA,SALIDA,AJUSTE',
            'cantidad' => 'required_unless:tipo_movimiento,AJUSTE|integer|min:1',
            'stock_destino' => 'required_if:tipo_movimiento,AJUSTE|integer|min:0',
            'justificacion' => 'required|string|min:3|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'tipo_movimiento.required' => 'Debes seleccionar un tipo de movimiento.',
            'tipo_movimiento.in' => 'El tipo de movimiento no es válido.',
            'cantidad.required_unless' => 'La cantidad es obligatoria para entradas y salidas.',
            'cantidad.min' => 'La cantidad debe ser mayor o igual a 1.',
            'stock_destino.required_if' => 'El stock destino es obligatorio para un ajuste.',
            'stock_destino.min' => 'El stock destino no puede ser negativo.',
            'justificacion.required' => 'La justificación es obligatoria.',
            'justificacion.min' => 'La justificación debe tener al menos 3 caracteres.',
        ];
    }
}
