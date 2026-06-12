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
            'marca' => 'sometimes|string|max:255',
            'modelo' => 'sometimes|string|max:255',
            'fecha_adquisicion' => 'sometimes|date',
            'costo_adquisicion' => 'nullable|numeric|min:0',
            'vida_util_meses' => 'nullable|integer|min:1',
            'almacen_id' => 'sometimes|exists:warehouses,id',
        ];
    }
}
