<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaintenancePlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'printer_model_id' => [
                'nullable',
                'exists:printer_models,id',
                Rule::prohibitedIf($this->filled('printer_id')),
            ],
            'printer_id' => [
                'nullable',
                'exists:printers,id',
                Rule::prohibitedIf($this->filled('printer_model_id')),
            ],
            'activo' => 'nullable|boolean',
            'periodicidad_meses' => 'nullable|integer|min:1|max:120',
            'periodicidad_paginas' => 'nullable|integer|min:1|max:1000000',
            'ventana_aviso_dias' => 'nullable|integer|min:1|max:180',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $meses = $this->input('periodicidad_meses');
            $paginas = $this->input('periodicidad_paginas');

            if (empty($meses) && empty($paginas)) {
                $validator->errors()->add(
                    'periodicidad_meses',
                    'Define al menos una periodicidad (meses o páginas).'
                );
            }
        });
    }
}
