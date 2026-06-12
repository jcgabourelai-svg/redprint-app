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
  kpis: Record<string, number | string>
  impresoras_por_estado: Record<string, number>
  alertas: Record<string, unknown[]>
}