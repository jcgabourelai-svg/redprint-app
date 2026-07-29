<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePrinterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'printer_model_id' => 'sometimes|exists:printer_models,id',
            'num_serie' => 'sometimes|string|max:255|unique:printers,num_serie,' . $this->route('printer')?->id,
            'fecha_adquisicion' => 'sometimes|date',
            'costo_adquisicion' => 'nullable|numeric|min:0',
            'vida_util_meses' => 'nullable|integer|min:1',
            'almacen_id' => 'sometimes|exists:warehouses,id',
        ];
    }

    public function messages(): array
    {
        return [
            'num_serie.unique' => 'El numero de serie ya existe',
        ];
    }
}
