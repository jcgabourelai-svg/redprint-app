import type { BankMovementType, ReconciliationStatus } from './enums'

export interface BankMovement {
  id: string
  cuenta_id: string
  fecha: string
  tipo: BankMovementType
  monto: number
  referencia: string
  descripcion: string
  conciliacion_status: ReconciliationStatus
  transaccion_vinculada?: string
  categoria?: string
}