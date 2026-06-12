export type PurchasePaymentMethod = 'contado' | 'credito' | 'parcial'

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
  estado: string
  contrato_id?: string
  notas?: string
  comprobante?: string
}

export interface InvoicePrinterDetail {
  impresora_id: string
  impresora_nombre: string
  paginas_consumidas: number
  monto_calculado: number
}

export interface Payment {
  id: string
  factura_id?: string
  compra_id?: string
  fecha: string
  monto: number
  metodo: string
  cuenta_bancaria_id?: string
  cuenta_bancaria_nombre?: string
  socio_registro: string
  comprobante?: string
  referencia?: string
}

export interface Purchase {
  id: string
  proveedor: string
  fecha_compra: string
  fecha_vencimiento_pago?: string
  concepto: string
  monto_total: number
  saldo_pendiente: number
  metodo_pago: PurchasePaymentMethod
  estado: string
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

export interface PurchasePayment {
  id: string
  fecha: string
  monto: number
  metodo: string
  cuenta_bancaria_id?: string
  socio_registro: string
  comprobante?: string
}

export interface BankAccount {
  id: string
  banco: string
  tipo: string
  numero_cuenta: string
  moneda: string
  saldo: number
  saldo_inicial: number
  descripcion?: string
  fecha_registro: string
  estado: 'activa' | 'inactiva'
  conciliacion_status: string
}

export interface BankMovement {
  id: string
  cuenta_id: string
  fecha: string
  tipo: string
  monto: number
  referencia: string
  descripcion: string
  conciliacion_status: string
  transaccion_vinculada?: string
  categoria?: string
}

export interface PeriodClose {
  id: string
  periodo: string
  estado: string
  fecha_cierre?: string
  cerrado_por?: string
  ingresos: number
  egresos: number
  rentabilidad: number
  facturas_emitidas: number
  facturas_pagadas: number
  facturas_pendientes: number
  gastos_registrados: number
  movimientos_bancarios: number
  movimientos_conciliados: number
  movimientos_pendientes: number
  validaciones: PeriodValidation[]
}

export interface PeriodValidation {
  id: string
  nombre: string
  estado: string
  mensaje: string
  link?: string
}

export interface ProfitabilityData {
  impresora_id: string
  impresora_nombre: string
  ingresos: number
  costos: number
  rentabilidad: number
  roi: number
}

export interface ClientProfitability {
  cliente_id: string
  cliente_nombre: string
  contratos: number
  ingresos: number
  costos: number
  rentabilidad: number
  margen: number
}

export interface CashFlowData {
  mes: string
  ingresos: number
  egresos: number
  flujo_neto: number
}

export interface ExpenseBreakdown {
  categoria: string
  gastos: number
  monto: number
  porcentaje: number
}