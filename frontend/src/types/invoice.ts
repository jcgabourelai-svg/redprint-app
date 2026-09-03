import type { InvoiceStatus } from './enums'

export interface Invoice {
  id: string
  /** Alias legacy usado por algunos listados; el API envia numero_factura. */
  numero: string
  numero_factura: string | null
  cliente_id: string
  cliente_nombre: string
  fecha_emision: string | null
  fecha_vencimiento: string | null
  periodo_inicio: string | null
  periodo_fin: string | null
  subtotal: number
  iva: number
  monto_total: number
  monto_pagado: number
  saldo_pendiente: number
  estado: InvoiceStatus
  contrato_id?: string
  notas?: string | null
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

/** Factura que toca un contrato (por encabezado o por detalles), D19. */
export interface BilledInvoice {
  factura_id: number
  numero_factura: string | null
  estado: InvoiceStatus
  periodo_inicio: string
  periodo_fin: string
  /** Fecha de inicio del rango facturado (AAAA-MM-DD). */
  periodo: string
  /** Suma de los detalles del contrato en esa factura. */
  monto_contrato: number
  monto_total: number
}

/** Ciclo pendiente de facturar de un contrato (periodos por aniversario, D17). */
export interface PendingPeriod {
  /** Fecha de inicio del ciclo (AAAA-MM-DD). */
  periodo: string
  periodo_inicio: string
  periodo_fin: string
  lecturas: number
  paginas: number
  monto_estimado: number
  advertencias: string[]
  actual: boolean
  /** D22: ciclos que acumula el paquete (arrastre por ciclos sin corte). */
  ciclos_acumulados?: number
  /** Paquete efectivo: ciclos_acumulados × paginas_incluidas. */
  paginas_incluidas_efectivas?: number
  /** Fecha de la lectura de cierre del ciclo (null = renta base). */
  lectura_cierre_fecha?: string | null
}

/** Respuesta de GET /contracts/{id}/facturacion. */
export interface ContractBillingStatus {
  facturados: BilledInvoice[]
  pendientes: PendingPeriod[]
  /** Fecha de inicio del último ciclo cubierto (AAAA-MM-DD) o null. */
  ultimo_periodo_cubierto: string | null
}

/** Respuesta de POST /invoices/draft-batch. */
export interface DraftBatchResponse {
  data: Invoice[]
  advertencias: Record<string, string[]>
}