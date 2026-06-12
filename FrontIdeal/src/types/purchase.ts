import type { PurchaseStatus } from './enums'

export interface Purchase {
  id: string
  proveedor: string
  fecha_compra: string
  fecha_vencimiento_pago?: string
  concepto: string
  monto_total: number
  saldo_pendiente: number
  metodo_pago: 'contado' | 'credito' | 'parcial'
  estado: PurchaseStatus
  articulos: PurchaseDetail[]
  numero_factura_proveedor?: string
  mano_de_obra: number
  socio_registro: string
  notas?: string
}

export interface PurchaseDetail {
  articulo_id: string
  articulo_nombre: string
  cantidad: number
  costo_unitario: number
  subtotal: number
}