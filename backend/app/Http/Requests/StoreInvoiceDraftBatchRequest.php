<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class StoreInvoiceDraftBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cliente_id' => 'required|exists:clients,id',
            // El batch es siempre por contrato (D18: un borrador por periodo).
            'contrato_id' => 'required|exists:contracts,id',
            'periodos' => 'required|array|min:1|max:24',
            'periodos.*' => [
                'required',
                'string',
                'date_format:Y-m',
                'distinct',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (Carbon::createFromFormat('Y-m', $value)->startOfMonth()->isFuture()) {
                        $fail('El periodo ' . $value . ' no puede ser futuro.');
                    }
                },
            ],
            'notas' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'cliente_id.required' => 'El cliente es obligatorio',
            'contrato_id.required' => 'El contrato es obligatorio',
            'periodos.required' => 'Debes seleccionar al menos un periodo',
            'periodos.min' => 'Debes seleccionar al menos un periodo',
            'periodos.max' => 'No se pueden generar más de 24 borradores a la vez',
            'periodos.*.date_format' => 'El periodo :input no tiene el formato AAAA-MM',
            'periodos.*.distinct' => 'Hay periodos repetidos en la selección',
        ];
    }
}
