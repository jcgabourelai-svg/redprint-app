<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMaintenanceOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * La orden nace con fecha de reporte: si el cliente no envía `fecha`
     * (form web), se estampa hoy. El móvil la sigue enviando explícita.
     */
    protected function prepareForValidation(): void
    {
        if (!$this->has('fecha')) {
            $this->merge(['fecha' => today()->toDateString()]);
        }
    }

    public function rules(): array
    {
        return [
            'impresora_id' => 'required|exists:printers,id',
            'fecha' => 'required|date',
            'tipo_mantto' => 'required|in:PREVENTIVO,CORRECTIVO',
            'desc_problema' => 'nullable|string',
            'tipo_problema' => 'nullable|in:NO_IMPRIME,CALIDAD_DEFICIENTE,ATASCOS,ERROR_PANTALLA,OTRO',
            'severidad' => 'nullable|in:BAJA,MEDIA,ALTA,CRITICA',
            'foto_evidencia' => 'nullable|string',
            'trabajo_realizado' => 'nullable|string',
            'costo_mano_obra' => 'nullable|numeric|min:0',
            'visita_id' => 'nullable|exists:visits,id',
        ];
    }
}
