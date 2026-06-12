import type { PeriodStatus, ValidationState } from './enums'

export interface PeriodClose {
  id: string
  periodo: string
  estado: PeriodStatus
  fecha_cierre?: string
  cerrado_por?: string
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
  validaciones: PeriodValidation[]
}

export interface PeriodValidation {
  id: string
  nombre: string
  estado: ValidationState
  mensaje: string
  link?: string
}