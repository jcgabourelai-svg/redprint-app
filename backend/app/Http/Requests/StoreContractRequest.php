<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreContractRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cliente_id' => 'required|exists:clients,id',
            'fecha_inicio' => 'required|date',
            'fecha_fin' => 'nullable|date|after:fecha_inicio',
            'tarifa_base' => 'required|numeric|min:0',
            'paginas_incluidas' => 'required|integer|min:0',
            'costo_pag_excedente' => 'required|numeric|min:0',
            'dias_gracia' => 'nullable|integer|min:0',
            'frecuencia_visitas' => 'required|string|in:MENSUAL,QUINCENAL,SEMANAL,CUSTOM',
            'dias_adelanto' => 'nullable|integer|min:1',
            'dia_visita' => 'nullable|integer|between:1,31',
            'impresoras' => 'nullable|array',
            'impresoras.*.id' => 'required_with:impresoras|exists:printers,id',
            'impresoras.*.lectura_inicial' => 'nullable|integer|min:0',
            'impresoras.*.alias' => 'nullable|string|max:60',
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

    public function messages(): array
    {
        return [
            'cliente_id.required' => 'El cliente es obligatorio',
            'fecha_inicio.required' => 'La fecha de inicio es obligatoria',
            'tarifa_base.required' => 'La tarifa base es obligatoria',
            'paginas_incluidas.required' => 'Las paginas incluidas son obligatorias',
            'costo_pag_excedente.required' => 'El costo por pagina excedente es obligatorio',
            'frecuencia_visitas.required' => 'La frecuencia de visitas es obligatoria',
        ];
    }
}
