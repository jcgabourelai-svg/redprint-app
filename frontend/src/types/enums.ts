export const PrinterStatus = {
  EN_ALMACEN: 'EN_ALMACEN',
  RENTADA: 'RENTADA',
  EN_MANTENIMIENTO: 'EN_MANTENIMIENTO',
  DADA_DE_BAJA: 'DADA_DE_BAJA',
} as const
export type PrinterStatus = (typeof PrinterStatus)[keyof typeof PrinterStatus]

export const ContractStatus = {
  ACTIVO: 'ACTIVO',
  SUSPENDIDO: 'SUSPENDIDO',
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
} as const
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus]

export const InvoiceStatus = {
  PENDIENTE: 'PENDIENTE',
  PARCIALMENTE_PAGADA: 'PARCIALMENTE_PAGADA',
  PAGADA: 'PAGADA',
  VENCIDA: 'VENCIDA',
  INCOBRABLE: 'INCOBRABLE',
} as const
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

export const VisitStatus = {
  PENDIENTE: 'PENDIENTE',
  COMPLETADA: 'COMPLETADA',
  REPROGRAMADA: 'REPROGRAMADA',
  CANCELADA: 'CANCELADA',
} as const
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus]

export const VisitType = {
  LECTURA: 'LECTURA',
  MANTENIMIENTO: 'MANTENIMIENTO',
  INSTALACION: 'INSTALACION',
  RETIRO: 'RETIRO',
} as const
export type VisitType = (typeof VisitType)[keyof typeof VisitType]

export const MaintenanceType = {
  PREVENTIVO: 'PREVENTIVO',
  CORRECTIVO: 'CORRECTIVO',
} as const
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType]

export const MaintenanceStatus = {
  PROGRAMADA: 'PROGRAMADA',
  EN_PROCESO: 'EN_PROCESO',
  COMPLETADA: 'COMPLETADA',
  CANCELADA: 'CANCELADA',
} as const
export type MaintenanceStatus = (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus]

export const UserRole = {
  ADMIN: 'ADMIN',
  OPERADOR: 'OPERADOR',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const VisitFrequency = {
  MENSUAL: 'MENSUAL',
  QUINCENAL: 'QUINCENAL',
  SEMANAL: 'SEMANAL',
  CUSTOM: 'CUSTOM',
} as const
export type VisitFrequency = (typeof VisitFrequency)[keyof typeof VisitFrequency]

export const PaymentMethod = {
  EFECTIVO: 'EFECTIVO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  DEPOSITO: 'DEPOSITO',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PurchaseStatus = {
  PENDIENTE: 'PENDIENTE',
  RECIBIDA: 'RECIBIDA',
  CANCELADA: 'CANCELADA',
} as const
export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus]

export const ArticleType = {
  CONSUMIBLE: 'CONSUMIBLE',
  PIEZA_REPUESTO: 'PIEZA_REPUESTO',
} as const
export type ArticleType = (typeof ArticleType)[keyof typeof ArticleType]

export const MovementType = {
  ENTRADA: 'ENTRADA',
  SALIDA: 'SALIDA',
  AJUSTE: 'AJUSTE',
} as const
export type MovementType = (typeof MovementType)[keyof typeof MovementType]

export const BankMovementType = {
  DEPOSITO: 'DEPOSITO',
  RETIRO: 'RETIRO',
} as const
export type BankMovementType = (typeof BankMovementType)[keyof typeof BankMovementType]

export const ReconciliationStatus = {
  PENDIENTE: 'PENDIENTE',
  CONCILIADO: 'CONCILIADO',
  NO_CONCILIADO: 'NO_CONCILIADO',
} as const
export type ReconciliationStatus = (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus]

export const PeriodStatus = {
  ABIERTO: 'ABIERTO',
  CERRADO: 'CERRADO',
} as const
export type PeriodStatus = (typeof PeriodStatus)[keyof typeof PeriodStatus]

export const ValidationState = {
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
} as const
export type ValidationState = (typeof ValidationState)[keyof typeof ValidationState]