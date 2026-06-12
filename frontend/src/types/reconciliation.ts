import type { ReconciliationStatus } from './enums'

export interface ReconciliationData {
  periodo: string
  cuenta_id: string
  cuenta_nombre: string
  saldo_bancario: number
  saldo_sistema: number
  diferencia: number
  estado: ReconciliationStatus
  movimientos_por_conciliar: number
  ultimo_reconciliado?: string
}