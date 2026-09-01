<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceDraftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Un borrador nace sin folio ni fechas: se calcula en el servidor
            // y se "emite" despues con los datos reales del PAC.
            'numero_factura' => 'prohibited',
            'fecha_emision' => 'prohibited',
            'fecha_vencimiento' => 'prohibited',
            'cliente_id' => 'required|exists:clients,id',
            // Opcional: limita el borrador a un contrato del cliente. Si no
            // viene y el calculo cubre un solo contrato, se auto-deriva (D19).
            'contrato_id' => 'nullable|exists:contracts,id',
            'periodo_inicio' => 'required|date',
            'periodo_fin' => 'required|date|after_or_equal:periodo_inicio',
            'notas' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'cliente_id.required' => 'El cliente es obligatorio',
            'periodo_inicio.required' => 'La fecha de inicio del periodo es obligatoria',
            'periodo_fin.required' => 'La fecha de fin del periodo es obligatoria',
            'periodo_fin.after_or_equal' => 'El fin del periodo no puede ser anterior al inicio',
        ];
    }
}
