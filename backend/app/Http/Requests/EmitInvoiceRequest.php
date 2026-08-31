<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EmitInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'numero_factura' => 'required|string|max:255',
            'fecha_emision' => 'required|date',
        ];
    }

    public function messages(): array
    {
        return [
            'numero_factura.required' => 'El numero de factura es obligatorio para emitir',
            'fecha_emision.required' => 'La fecha de emision es obligatoria para emitir',
        ];
    }
}
