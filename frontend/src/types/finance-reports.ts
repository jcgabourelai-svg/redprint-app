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