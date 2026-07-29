<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePrinterModelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'brand_id' => 'required|exists:printer_brands,id',
            'nombre' => 'required|string|max:255',
        ];
    }
}
