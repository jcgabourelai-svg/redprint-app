<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class XmlComprobanteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'version' => $this->version,
            'serie' => $this->serie,
            'folio' => $this->folio,
            'serie_folio' => $this->serie_folio,
            'tipo_comprobante' => $this->tipo_comprobante?->value,
            'fecha_emision' => $this->fecha_emision?->toIso8601String(),
            'moneda' => $this->moneda,
            'tipo_cambio' => $this->tipo_cambio,
            'forma_pago' => $this->forma_pago,
            'metodo_pago' => $this->metodo_pago,
            'lugar_expedicion' => $this->lugar_expedicion,
            'condiciones_de_pago' => $this->condiciones_de_pago,
            'confirmacion' => $this->confirmacion,

            'rfc_emisor' => $this->rfc_emisor,
            'nombre_emisor' => $this->nombre_emisor,
            'regimen_fiscal_emisor' => $this->regimen_fiscal_emisor,

            'rfc_receptor' => $this->rfc_receptor,
            'nombre_receptor' => $this->nombre_receptor,
            'uso_cfdi' => $this->uso_cfdi,
            'regimen_fiscal_receptor' => $this->regimen_fiscal_receptor,
            'domicilio_fiscal_receptor' => $this->domicilio_fiscal_receptor,

            'subtotal' => $this->subtotal,
            'descuento' => $this->descuento,
            'total' => $this->total,
            'total_impuestos_trasladados' => $this->total_impuestos_trasladados,
            'total_impuestos_retenidos' => $this->total_impuestos_retenidos,
            'iva_trasladado' => $this->iva_trasladado,
            'iva_retenido' => $this->iva_retenido,

            'estado_sat' => $this->estado_sat,
            'notas' => $this->notas,

            'receptor_id' => $this->receptor_id,
            'estado_conciliacion' => $this->estado_conciliacion,
            'estado_cliente' => $this->estado_cliente,

            'conceptos' => XmlConceptoResource::collection($this->whenLoaded('conceptos')),
            'invoice' => new InvoiceResource($this->whenLoaded('invoice')),
            'receptor' => new ClientResource($this->whenLoaded('receptor')),
        ];
    }
}
