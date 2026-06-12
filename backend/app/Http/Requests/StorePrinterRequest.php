<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePrinterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'marca' => 'required|string|max:255',
            'modelo' => 'required|string|max:255',
            'num_serie' => 'required|string|unique:printers,num_serie',
            'fecha_adquisicion' => 'required|date',
            'costo_adquisicion' => 'nullable|numeric|min:0',
            'vida_util_meses' => 'nullable|integer|min:1',
            'almacen_id' => 'required|exists:warehouses,id',
            'contador_actual' => 'nullable|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'marca.required' => 'La marca es obligatoria',
            'modelo.required' => 'El modelo es obligatorio',
            'num_serie.required' => 'El numero de serie es obligatorio',
            'num_serie.unique' => 'El numero de serie ya existe',
            'fecha_adquisicion.required' => 'La fecha de adquisicion es obligatoria',
            'almacen_id.required' => 'El almacen es obligatorio',
            'almacen_id.exists' => 'El almacen no existe',
        ];
    }
}
