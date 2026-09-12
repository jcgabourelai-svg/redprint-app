<?php

namespace App\Http\Requests;

use App\Support\TonerLevels;
use Illuminate\Foundation\Http\FormRequest;

class StoreReadingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'visita_id' => 'required|exists:visits,id',
            'impresora_id' => 'required|exists:printers,id',
            'contrato_id' => 'nullable|exists:contracts,id',
            'fecha' => 'required|date',
            'valor_contador' => 'required|integer|min:0',
            'niveles_toner' => ['nullable', 'array:k,c,m,y'],
            'niveles_toner.k' => ['nullable', 'integer', 'min:0', 'max:100'],
            'niveles_toner.c' => ['nullable', 'integer', 'min:0', 'max:100'],
            'niveles_toner.m' => ['nullable', 'integer', 'min:0', 'max:100'],
            'niveles_toner.y' => ['nullable', 'integer', 'min:0', 'max:100'],
            'foto_evidencia' => 'nullable|string',
            'justificacion_anomalia' => 'nullable|string',
            'ubicacion_lat' => 'nullable|numeric',
            'ubicacion_lng' => 'nullable|numeric',
        ];
    }

    /**
     * Normaliza niveles_toner (normalizador compartido con field records):
     * descarta claves en null, castea numéricos y anula el campo si no
     * queda ningún valor.
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('niveles_toner') !== null) {
            $this->merge(['niveles_toner' => TonerLevels::normalizar($this->input('niveles_toner'))]);
        }
    }

    public function messages(): array
    {
        return [
            'visita_id.required' => 'La visita es obligatoria',
            'impresora_id.required' => 'La impresora es obligatoria',
            'fecha.required' => 'La fecha es obligatoria',
            'valor_contador.required' => 'El valor del contador es obligatorio',
            'valor_contador.min' => 'El valor del contador no puede ser negativo',
            'niveles_toner.array' => 'El nivel de tóner debe incluir solo las claves k, c, m, y',
            'niveles_toner.k.integer' => 'El nivel de tóner negro debe ser un número entero',
            'niveles_toner.c.integer' => 'El nivel de tóner cian debe ser un número entero',
            'niveles_toner.m.integer' => 'El nivel de tóner magenta debe ser un número entero',
            'niveles_toner.y.integer' => 'El nivel de tóner amarillo debe ser un número entero',
            'niveles_toner.k.min' => 'El nivel de tóner negro debe estar entre 0 y 100',
            'niveles_toner.k.max' => 'El nivel de tóner negro debe estar entre 0 y 100',
            'niveles_toner.c.min' => 'El nivel de tóner cian debe estar entre 0 y 100',
            'niveles_toner.c.max' => 'El nivel de tóner cian debe estar entre 0 y 100',
            'niveles_toner.m.min' => 'El nivel de tóner magenta debe estar entre 0 y 100',
            'niveles_toner.m.max' => 'El nivel de tóner magenta debe estar entre 0 y 100',
            'niveles_toner.y.min' => 'El nivel de tóner amarillo debe estar entre 0 y 100',
            'niveles_toner.y.max' => 'El nivel de tóner amarillo debe estar entre 0 y 100',
        ];
    }
}
