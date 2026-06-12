<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'proveedor_id' => 'required|exists:suppliers,id',
            'fecha' => 'required|date',
            'fecha_vto_pago' => 'nullable|date|after_or_equal:fecha',
            'concepto' => 'required|string|max:255',
            'metodo_pago' => 'nullable|string',
            'comprobante' => 'nullable|string',
            'detalles' => 'required|array|min:1',
            'detalles.*.articulo_id' => 'nullable|exists:articles,id',
            'detalles.*.articulo_nombre' => 'required|string|max:255',
            'detalles.*.cantidad' => 'required|integer|min:1',
            'detalles.*.costo_unitario' => 'required|numeric|min:0',
        ];
    }
}
