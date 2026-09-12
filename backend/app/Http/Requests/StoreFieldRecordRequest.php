<?php

namespace App\Http\Requests;

use App\Support\TonerLevels;
use Illuminate\Foundation\Http\FormRequest;

class StoreFieldRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo' => 'required|in:LECTURA,ENTREGA_INSUMOS,OTRO',
            'nombre_cliente_reportado' => 'required|string|max:255',
            'direccion_reportada' => 'nullable|string|max:255',
            'marca_reportada' => 'nullable|string|max:255',
            'modelo_reportada' => 'nullable|string|max:255',
            'num_serie_reportado' => 'nullable|string|max:255',
            'valor_contador' => 'required_if:tipo,LECTURA|integer|min:0',
            'niveles_toner' => ['nullable', 'array:k,c,m,y'],
            'niveles_toner.k' => ['nullable', 'integer', 'min:0', 'max:100'],
            'niveles_toner.c' => ['nullable', 'integer', 'min:0', 'max:100'],
            'niveles_toner.m' => ['nullable', 'integer', 'min:0', 'max:100'],
            'niveles_toner.y' => ['nullable', 'integer', 'min:0', 'max:100'],
            'articulos_entregados' => 'nullable|array',
            'articulos_entregados.*.descripcion' => 'required_with:articulos_entregados|string|max:255',
            'articulos_entregados.*.cantidad' => 'required_with:articulos_entregados|integer|min:1',
            'notas' => 'nullable|string',
            'foto_evidencia' => 'nullable|string',
            'ubicacion_lat' => 'nullable|numeric',
            'ubicacion_lng' => 'nullable|numeric',
            'capturado_en' => 'nullable|date',
            // Sin regla unique: el dedup idempotente lo maneja el servicio
            // (devuelve la fila existente en vez de un 422 ante un reintento
            // de sync ambiguo). El indice unique en BD protege contra carreras.
            'client_uuid' => 'nullable|uuid',
        ];
    }

    /**
     * Normaliza niveles_toner (normalizador compartido con lecturas): el
     * valor almacenado viaja verbatim a la lectura al regularizar, así que
     * ambas entradas deben producir exactamente la misma forma.
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
            'tipo.required' => 'El tipo de registro es obligatorio',
            'nombre_cliente_reportado.required' => 'El nombre del cliente reportado es obligatorio',
            'valor_contador.required_if' => 'El valor del contador es obligatorio para registros de lectura',
            'niveles_toner.array' => 'El nivel de tóner debe incluir solo las claves k, c, m, y',
            'niveles_toner.*.integer' => 'El nivel de tóner debe ser un número entero',
            'niveles_toner.*.min' => 'El nivel de tóner debe estar entre 0 y 100',
            'niveles_toner.*.max' => 'El nivel de tóner debe estar entre 0 y 100',
        ];
    }
}
