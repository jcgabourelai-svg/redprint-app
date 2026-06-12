import type {
  PrinterStatus,
  ContractStatus,
  InvoiceStatus,
  VisitStatus,
  VisitType,
  PaymentMethod,
  VisitFrequency,
  UserRole,
  BankAccountType,
  Currency,
  BankName,
  ReconciliationStatus,
  BankMovementType,
  PeriodStatus,
  ValidationState,
} from './enums'

export type { PaginatedResponse } from './api'

export interface User {
  id: number
  nombre: string
  correo: string
  telefono: string | null
  rol: UserRole
  activo: boolean
  ultimo_acceso: string | null
  fecha_creacion: string
}

export interface Warehouse {
  id: number
  nombre: string
  direccion: string
  responsable: User | null
  activo: boolean
  printers_count?: number
}

export interface Printer {
  id: number
  marca: string
  modelo: string
  num_serie: string
  codigo_negocio: string
  fecha_adquisicion: string
  costo_adquisicion: number | null
  vida_util_meses: number | null
  estado: PrinterStatus
  almacen_id: number | null
  warehouse?: Warehouse | null
  contador_actual: number
  creado_por: number
  creator?: User
  fecha_creacion: string
}

export interface PrinterHistoryEntry {
  id: number
  impresora_id: number
  tipo_evento: string
  descripcion: string | null
  datos_adicionales: Record<string, unknown> | null
  socio: User
  fecha: string
}

export interface Client {
  id: number
  razon_social: string
  rfc: string | null
  nombre_contacto: string
  telefono: string
  correo: string | null
  direccion_instalacion: string
  notas: string | null
  creado_por: number
  fecha_creacion: string
  contracts?: Contract[]
}

export interface Contract {
  id: number
  codigo_negocio: string
  cliente_id: number
  fecha_inicio: string
  fecha_fin: string | null
  tarifa_base: number
  paginas_incluidas: number
  costo_pag_excedente: number
  dias_gracia: number
  frecuencia_visitas: VisitFrequency
  dias_adelanto: number
  estado: ContractStatus
  client?: Client
  printers?: Printer[]
  visits?: Visit[]
  fecha_creacion: string
}

export interface Visit {
  id: number
  cliente_id: number
  contrato_id: number | null
  tipo_visita: VisitType
  fecha_programada: string | null
  fecha_realizada: string | null
  socio_id: number
  estado: VisitStatus
  notas: string | null
  client?: Client
  contract?: Contract
  socio?: User
  readings?: Reading[]
  fecha_creacion: string
}

export interface Reading {
  id: number
  visita_id: number
  impresora_id: number
  contrato_id: number | null
  fecha: string
  valor_contador: number
  paginas_periodo: number
  socio_id: number
  foto_evidencia: string | null
  justificacion_anomalia: string | null
  es_anomalia: boolean
  ubicacion_lat: number | null
  ubicacion_lng: number | null
  printer?: Printer
  socio?: User
  fecha_creacion: string
}

export interface Invoice {
  id: number
  numero_factura: string
  cliente_id: number
  contrato_id: number | null
  fecha_emision: string
  fecha_vencimiento: string
  periodo_inicio: string | null
  periodo_fin: string | null
  monto_total: number
  monto_pagado: number
  saldo_pendiente: number
  estado: InvoiceStatus
  notas: string | null
  socio_id: number
  client?: Client
  details?: InvoiceDetail[]
  payments?: Payment[]
  fecha_creacion: string
}

export interface InvoiceDetail {
  id: number
  factura_id: number
  contrato_id: number | null
  impresora_id: number | null
  lectura_id: number | null
  paginas_consumidas: number
  monto_calculado: number
}

export interface Payment {
  id: number
  factura_id: number
  fecha: string
  monto: number
  metodo_pago: PaymentMethod
  nota: string | null
  socio_id: number
  socio?: User
  fecha_creacion: string
}

export interface Supplier {
  id: number
  razon_social: string
  rfc: string | null
  contacto: string | null
  telefono: string | null
  correo: string | null
  notas: string | null
  activo: boolean
}

export interface Notification {
  id: string
  usuario_id: number
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  referencia_tipo: string | null
  referencia_id: number | null
  fecha: string
}

export interface Article {
  id: number
  tipo_articulo: string
  subtipo: string | null
  nombre: string
  marca: string | null
  modelo_sku: string | null
  stock_actual: number
  umbral_reposicion: number
  costo_unitario: number
  proveedor_id: number | null
  supplier?: Supplier | null
  impresoras_compatibles: number[] | null
  activo: boolean
  is_low_stock: boolean
  fecha_creacion: string
}

export interface InventoryMovement {
  id: number
  articulo_id: number
  article?: Article
  tipo_movimiento: string
  cantidad: number
  stock_anterior: number
  stock_posterior: number
  referencia_tipo: string | null
  referencia_id: number | null
  justificacion: string | null
  fecha: string
  socio?: User
  fecha_creacion: string
}

export interface MaintenanceOrder {
  id: number
  impresora_id: number
  printer?: Printer
  fecha: string
  tipo_mantto: string
  desc_problema: string | null
  trabajo_realizado: string | null
  proveedor_id: number | null
  supplier?: Supplier | null
  costo_mano_obra: number
  costo_total: number
  socio_id: number
  socio?: User
  visita_id: number | null
  visit?: Visit
  estado: string
  articles_used?: ArticleUsed[]
  expenses?: PrinterExpense[]
  fecha_creacion: string
}

export interface ArticleUsed {
  id: number
  articulo_id: number
  article?: Article
  cantidad: number
  costo_unitario: number
  subtotal: number
}

export interface Purchase {
  id: number
  proveedor_id: number
  supplier?: Supplier | null
  fecha: string
  fecha_vto_pago: string | null
  concepto: string
  monto_total: number
  monto_pagado: number
  saldo_pendiente: number
  metodo_pago: string | null
  estado: string
  comprobante: string | null
  socio_id: number
  details?: PurchaseDetail[]
  payments?: SupplierPaymentModel[]
  fecha_creacion: string
}

export interface PurchaseDetail {
  id: number
  compra_id: number
  articulo_id: number | null
  article?: Article
  articulo_nombre: string
  cantidad: number
  costo_unitario: number
  subtotal: number
}

export interface SupplierPaymentModel {
  id: number
  compra_id: number
  fecha: string
  monto: number
  metodo: string
  socio_id: number
  socio?: User
  comprobante: string | null
  fecha_creacion: string
}

export interface PrinterExpense {
  id: number
  impresora_id: number
  printer?: Printer
  tipo: string
  monto: number
  fecha: string
  descripcion: string | null
  socio_id: number
  socio?: User
  orden_mantto_id: number | null
  maintenanceOrder?: MaintenanceOrder
  comprobante: string | null
  fecha_creacion: string
}

export interface BankAccount {
  id: number
  banco: BankName
  tipo: BankAccountType
  numero_cuenta: string
  moneda: Currency
  saldo: number
  saldo_inicial: number
  descripcion: string | null
  fecha_registro: string
  estado: ReconciliationStatus
  conciliacion_status: ReconciliationStatus
  fecha_creacion: string
}

export interface BankMovement {
  id: number
  cuenta_id: number
  bankAccount?: BankAccount
  fecha: string
  tipo: BankMovementType
  monto: number
  referencia: string
  descripcion: string
  conciliacion_status: ReconciliationStatus
  transaccion_vinculada: string | null
  transaccion_tipo: string | null
  fecha_creacion: string
}

export interface PeriodClose {
  id: number
  periodo: string
  estado: PeriodStatus
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
  fecha_cierre: string | null
  cerrado_por: string | null
  validaciones: PeriodValidation[]
  fecha_creacion: string
}

export interface PeriodValidation {
  id: string
  nombre: string
  estado: ValidationState
  mensaje: string
  link: string | null
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

export interface IncomeBreakdown {
  cliente: string
  facturas: number
  monto: number
  porcentaje: number
}

export interface ExpenseBreakdown {
  categoria: string
  gastos: number
  monto: number
  porcentaje: number
}
