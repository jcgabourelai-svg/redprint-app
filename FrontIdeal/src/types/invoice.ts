import type { InvoiceStatus } from './enums'

export interface Invoice {
  id: string
  numero: string
  cliente_id: string
  cliente_nombre: string
  fecha_emision: string
  fecha_vencimiento: string
  periodo_inicio: string
  periodo_fin: string
  subtotal: number
  iva: number
  monto_total: number
  saldo_pendiente: number
  estado: InvoiceStatus
  contrato_id?: string
  notas?: string
  comprobante?: string
}

export interface InvoiceDetail {
  id: string
  factura_id: string
  concepto: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface InvoicePrinterDetail {
  impresora_id: string
  impresora_nombre: string
  paginas_consumidas: number
  monto_calculado: number
}