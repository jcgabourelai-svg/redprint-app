import type { TipoComprobante, EstadoConciliacion, EstadoCliente } from './enums'
import type { Client } from './client'
import type { Invoice } from './invoice'

export interface XmlConcepto {
  id: number
  clave_prod_serv?: string | null
  no_identificacion?: string | null
  cantidad: number
  clave_unidad?: string | null
  unidad?: string | null
  descripcion: string
  valor_unitario?: number | null
  importe: number
  descuento?: number | null
  objeto_imp?: string | null
}

export interface XmlComprobante {
  id: number
  uuid: string
  version: string
  serie?: string | null
  folio?: string | null
  serie_folio?: string | null
  tipo_comprobante: TipoComprobante
  fecha_emision: string
  moneda?: string | null
  tipo_cambio?: number | null
  forma_pago?: string | null
  metodo_pago?: string | null
  lugar_expedicion?: string | null
  condiciones_de_pago?: string | null
  confirmacion?: string | null
  rfc_emisor: string
  nombre_emisor?: string | null
  regimen_fiscal_emisor?: string | null
  rfc_receptor: string
  nombre_receptor?: string | null
  uso_cfdi?: string | null
  regimen_fiscal_receptor?: string | null
  domicilio_fiscal_receptor?: string | null
  subtotal: number
  descuento?: number | null
  total: number
  total_impuestos_trasladados?: number | null
  total_impuestos_retenidos?: number | null
  iva_trasladado?: number | null
  iva_retenido?: number | null
  estado_sat?: string | null
  notas?: string | null
  receptor_id?: number | null
  estado_conciliacion: EstadoConciliacion
  estado_cliente: EstadoCliente
  conceptos?: XmlConcepto[]
  invoice?: Invoice | null
  receptor?: Client | null
}

export type CfdiImportEstado = 'importado' | 'duplicado' | 'error'

export interface CfdiImportResultItem {
  archivo: string
  estado: CfdiImportEstado
  xml_comprobante?: XmlComprobante | null
  errores?: string | null
}
