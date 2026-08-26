<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMaintenanceOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'desc_problema' => 'nullable|string',
            'tipo_problema' => 'nullable|in:NO_IMPRIME,CALIDAD_DEFICIENTE,ATASCOS,ERROR_PANTALLA,OTRO',
            'severidad' => 'nullable|in:BAJA,MEDIA,ALTA,CRITICA',
            'trabajo_realizado' => 'nullable|string',
            'costo_mano_obra' => 'nullable|numeric|min:0',
            'fecha' => 'sometimes|date',
        ];
    }
}
