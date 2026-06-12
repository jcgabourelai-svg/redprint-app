<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'factura_id' => $this->factura_id,
            'contrato_id' => $this->contrato_id,
            'impresora_id' => $this->impresora_id,
            'lectura_id' => $this->lectura_id,
            'paginas_consumidas' => $this->paginas_consumidas,
            'monto_calculado' => $this->monto_calculado,
        ];
    }
}
