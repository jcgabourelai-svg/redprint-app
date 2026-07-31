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
  xml_comprobante_id?: number | null
  xml_comprobante?: { id: number; uuid: string; serie_folio?: string | null } | null
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

export interface InvoiceCalcLectura {
  lectura_id: number
  impresora_id: number
  fecha: string
  paginas_periodo: number
}

export interface InvoiceCalcContrato {
  contrato_id: number
  codigo: string
  tarifa_base: number
  paginas_incluidas: number
  costo_pag_excedente: number
  total_paginas: number
  monto_contrato: number
  lecturas: InvoiceCalcLectura[]
}

export interface InvoiceCalcDetalle {
  contrato_id?: number
  impresora_id?: number
  lectura_id?: number
  paginas_consumidas: number
  monto_calculado: number
}

export interface InvoiceCalculation {
  monto_total: number
  contratos: InvoiceCalcContrato[]
  detalles: InvoiceCalcDetalle[]
  advertencias: string[]
}