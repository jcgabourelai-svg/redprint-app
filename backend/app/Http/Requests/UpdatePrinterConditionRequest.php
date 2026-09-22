<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePrinterConditionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'condicion' => 'required|in:OPERATIVA,REQUIERE_ATENCION,NO_OPERATIVA,PIEZAS',
            'condicion_nota' => 'nullable|string',
            'motivo' => 'required|string|min:3',
        ];
    }
}
