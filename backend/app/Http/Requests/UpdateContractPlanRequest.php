<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateContractPlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'plan_impresoras' => 'nullable|array',
            'plan_impresoras.*.modelo_id' => 'required_with:plan_impresoras|exists:printer_models,id',
            'plan_impresoras.*.cantidad' => 'required_with:plan_impresoras|integer|between:1,20',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $rows = $this->input('plan_impresoras');

            if (!is_array($rows)) {
                return;
            }

            $modelos = collect($rows)
                ->filter(fn ($row) => !empty($row['modelo_id']))
                ->pluck('modelo_id');

            if ($modelos->count() !== $modelos->unique()->count()) {
                $validator->errors()->add(
                    'plan_impresoras',
                    'No se puede repetir el mismo modelo de impresora en el plan'
                );
            }
        });
    }
}
