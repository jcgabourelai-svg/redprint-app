<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class XmlConceptoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'clave_prod_serv' => $this->clave_prod_serv,
            'no_identificacion' => $this->no_identificacion,
            'cantidad' => $this->cantidad,
            'clave_unidad' => $this->clave_unidad,
            'unidad' => $this->unidad,
            'descripcion' => $this->descripcion,
            'valor_unitario' => $this->valor_unitario,
            'importe' => $this->importe,
            'descuento' => $this->descuento,
            'objeto_imp' => $this->objeto_imp,
        ];
    }
}
