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

export interface DashboardData {
  kpis: Record<string, number | string>
  impresoras_por_estado: Record<string, number>
  alertas: Record<string, unknown[]>
}