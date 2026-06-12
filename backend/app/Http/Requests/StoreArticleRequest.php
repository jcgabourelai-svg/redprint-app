<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo_articulo' => 'required|in:CONSUMIBLE,REPARACION',
            'subtipo' => 'nullable|string|max:100',
            'nombre' => 'required|string|max:255',
            'marca' => 'nullable|string|max:150',
            'modelo_sku' => 'nullable|string|max:150',
            'stock_actual' => 'nullable|integer|min:0',
            'umbral_reposicion' => 'nullable|integer|min:0',
            'costo_unitario' => 'required|numeric|min:0',
            'proveedor_id' => 'nullable|exists:suppliers,id',
            'impresoras_compatibles' => 'nullable|array',
            'impresoras_compatibles.*' => 'integer|exists:printers,id',
            'activo' => 'nullable|boolean',
        ];
    }
}
