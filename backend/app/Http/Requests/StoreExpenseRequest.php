<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'impresora_id' => 'required|exists:printers,id',
            'tipo' => 'required|in:TRANSPORTE,OTRO',
            'monto' => 'required|numeric|min:0',
            'fecha' => 'required|date',
            'descripcion' => 'nullable|string',
            'orden_mantto_id' => 'nullable|exists:maintenance_orders,id',
            'comprobante' => 'nullable|string',
        ];
    }
}
