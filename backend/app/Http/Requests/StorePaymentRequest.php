<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'factura_id' => 'required|exists:invoices,id',
            'fecha' => 'required|date',
            'monto' => 'required|numeric|min:0.01',
            'metodo_pago' => 'required|string|in:EFECTIVO,TRANSFERENCIA,DEPOSITO',
            'nota' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'factura_id.required' => 'La factura es obligatoria',
            'fecha.required' => 'La fecha es obligatoria',
            'monto.required' => 'El monto es obligatorio',
            'monto.min' => 'El monto debe ser mayor a 0',
            'metodo_pago.required' => 'El metodo de pago es obligatorio',
        ];
    }
}
