import type { ReconciliationStatus } from './enums'

export type BankAccountType = 'cheques' | 'debito' | 'ahorro'

export interface BankAccount {
  id: string
  banco: string
  tipo: BankAccountType
  numero_cuenta: string
  moneda: string
  saldo: number
  saldo_inicial: number
  descripcion?: string
  fecha_registro: string
  estado: 'activa' | 'inactiva'
  conciliacion_status: ReconciliationStatus
}