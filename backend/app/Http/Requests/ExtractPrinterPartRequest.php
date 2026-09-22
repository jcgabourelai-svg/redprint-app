<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExtractPrinterPartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'articulo_id' => 'nullable|exists:articles,id',
            'nombre_nuevo' => 'required_without:articulo_id|string|min:3',
            'tipo_articulo' => 'required_without:articulo_id|in:CONSUMIBLE,REPARACION',
            'cantidad' => 'required|integer|min:1',
            'costo_unitario' => 'nullable|numeric|min:0',
            'num_parte' => 'nullable|string',
        ];
    }
}
