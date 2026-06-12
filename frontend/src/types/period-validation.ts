import type { ValidationState } from './enums'

export interface PeriodValidation {
  id: string
  nombre: string
  estado: ValidationState
  mensaje: string
  link?: string
}