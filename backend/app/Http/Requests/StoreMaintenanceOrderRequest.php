<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMaintenanceOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'impresora_id' => 'required|exists:printers,id',
            'fecha' => 'required|date',
            'tipo_mantto' => 'required|in:PREVENTIVO,CORRECTIVO',
            'desc_problema' => 'nullable|string',
            'trabajo_realizado' => 'nullable|string',
            'costo_mano_obra' => 'nullable|numeric|min:0',
            'visita_id' => 'nullable|exists:visits,id',
        ];
    }
}
