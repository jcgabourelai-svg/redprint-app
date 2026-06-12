export interface PaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number
  to: number
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}

export interface DashboardData {
  kpis: {
    ingresos_mes: number
    ingresos_mes_anterior: number
    facturas_pendientes: number
    facturas_vencidas: number
    visitas_pendientes: number
    mis_visitas_proximas: number
    saldo_pendiente_total: number
  }
  impresoras_por_estado: Record<string, number>
  alertas: {
    facturas_vencidas: Array<{
      id: number
      numero_factura: string
      monto_total: number
      saldo_pendiente: number
      client: { id: number; razon_social: string }
    }>
    visitas_proximas: Array<{
      type: string
      visit_id: number
      client: string
      date: string
    }>
  }
}
