export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface PaginatedResponse<T> {
  data: T[]
  links?: Record<string, string | null>
  meta?: PaginationMeta
  // Campos heredados al nivel raíz (preferir `meta`). Algunos endpoints los
  // devuelven planos, pero el paginador por defecto de Laravel los anida en meta.
  current_page?: number
  last_page?: number
  per_page?: number
  total?: number
  from?: number
  to?: number
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}

export interface DashboardKpis {
  ingresos_mes: number
  ingresos_mes_anterior: number
  tendencia_ingresos_pct: number | null
  saldo_pendiente_total: number
  facturas_pendientes: number
  facturas_vencidas: number
  visitas_pendientes: number
  mis_visitas_proximas: number
  paginas_impresas_mes: number
  stock_bajo: number
  stock_critico: number
  valor_inventario: number
  mantenimientos_pendientes: number
  mantenimientos_completados_mes: number
  impresoras_en_mantenimiento: number
  compras_vencidas: number
  compras_por_vencer: number
}

export type PrinterEstado = 'RENTADA' | 'EN_ALMACEN' | 'EN_MANTENIMIENTO' | 'DADA_DE_BAJA'

export interface IngresoMes {
  mes: string
  mes_nombre: string
  total: number
}

export interface FlujoMes {
  mes: string
  mes_nombre: string
  ingresos: number
  egresos: number
  flujo_neto: number
  acumulado: number
}

export interface PrinterRentabilidad {
  impresora_id: string | number
  marca: string
  modelo: string
  codigo_negocio: string
  ingresos: number
  costos: number
  margen: number
  roi: number | null
}

export interface DashboardSeries {
  ingresos_6m: IngresoMes[]
  flujo_caja_6m: FlujoMes[]
  top_rentabilidad: PrinterRentabilidad[]
}

export interface DashboardFacturaVencida {
  id: string | number
  cliente_id: string | number
  numero_factura: string
  saldo_pendiente: number | string
  fecha_vencimiento: string | null
  client?: { razon_social?: string } | null
}

export interface DashboardVisitaProxima {
  visit_id?: string | number
  client?: string
  cliente_nombre?: string
  date?: string
  fecha_programada?: string
  [key: string]: unknown
}

export interface DashboardArticuloStockBajo {
  id: string | number
  nombre: string
  stock_actual: number
  umbral_reposicion: number
  supplier?: { razon_social?: string } | null
  [key: string]: unknown
}

export interface DashboardMantenimientoPendiente {
  id: string | number
  printer_codigo?: string
  impresora_id?: string | number
  fecha: string
  printer?: { codigo_negocio?: string; modelo?: string } | null
  [key: string]: unknown
}

export interface DashboardCompraPorVencer {
  id: string | number
  proveedor_id?: string | number
  saldo_pendiente: number | string
  fecha_vto_pago: string | null
  supplier?: { razon_social?: string } | null
  [key: string]: unknown
}

export interface DashboardAlertas {
  facturas_vencidas: DashboardFacturaVencida[]
  visitas_proximas: DashboardVisitaProxima[]
  articulos_stock_bajo: DashboardArticuloStockBajo[]
  mantenimientos_pendientes: DashboardMantenimientoPendiente[]
  compras_por_vencer: DashboardCompraPorVencer[]
}

export interface DashboardData {
  kpis: DashboardKpis
  impresoras_por_estado: Partial<Record<PrinterEstado, number>>
  series: DashboardSeries
  alertas: DashboardAlertas
}