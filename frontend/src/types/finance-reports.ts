export interface ProfitabilityData {
  impresora_id: number
  codigo_negocio: string | null
  marca: string
  modelo: string
  ingresos: number
  gastos: number
  mantenimiento: number
  insumos_toner: number
  costos: number
  margen: number
  roi: number | null
  paginas_periodo: number
  costo_toner_por_pagina: number | null
}

export interface ClientProfitability {
  cliente_id: number
  razon_social: string
  ingresos: number
  costos: number
  insumos_toner: number
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