<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'numero_factura' => 'required|string|unique:invoices,numero_factura',
            'cliente_id' => 'required|exists:clients,id',
            'contrato_id' => 'nullable|exists:contracts,id',
            'fecha_emision' => 'required|date',
            'fecha_vencimiento' => 'required|date|after_or_equal:fecha_emision',
            'periodo_inicio' => 'nullable|date',
            'periodo_fin' => 'nullable|date|after_or_equal:periodo_inicio',
            'monto_total' => 'required|numeric|min:0',
            'notas' => 'nullable|string',
            'detalles' => 'nullable|array',
            'detalles.*.contrato_id' => 'nullable|exists:contracts,id',
            'detalles.*.impresora_id' => 'nullable|exists:printers,id',
            'detalles.*.lectura_id' => 'nullable|exists:readings,id',
            'detalles.*.paginas_consumidas' => 'nullable|integer|min:0',
            'detalles.*.monto_calculado' => 'nullable|numeric|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'numero_factura.required' => 'El numero de factura es obligatorio',
            'numero_factura.unique' => 'El numero de factura ya existe',
            'cliente_id.required' => 'El cliente es obligatorio',
            'fecha_emision.required' => 'La fecha de emision es obligatoria',
            'fecha_vencimiento.required' => 'La fecha de vencimiento es obligatoria',
            'monto_total.required' => 'El monto total es obligatorio',
        ];
    }
}
