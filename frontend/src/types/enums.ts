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
  BORRADOR: 'BORRADOR',
  PENDIENTE: 'PENDIENTE',
  PARCIALMENTE_PAGADA: 'PARCIALMENTE_PAGADA',
  PAGADA: 'PAGADA',
  VENCIDA: 'VENCIDA',
  INCOBRABLE: 'INCOBRABLE',
} as const
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE: 'Pendiente',
  PARCIALMENTE_PAGADA: 'Parcialmente pagada',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
  INCOBRABLE: 'Incobrable',
}

export const VisitStatus = {
  PENDIENTE: 'PENDIENTE',
  COMPLETADA: 'COMPLETADA',
  REPROGRAMADA: 'REPROGRAMADA',
  CANCELADA: 'CANCELADA',
  OMITIDA: 'OMITIDA',
} as const
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus]

export const VisitType = {
  LECTURA: 'LECTURA',
  MANTENIMIENTO: 'MANTENIMIENTO',
  INSTALACION: 'INSTALACION',
  RETIRO: 'RETIRO',
  ENTREGA_INSUMOS: 'ENTREGA_INSUMOS',
} as const
export type VisitType = (typeof VisitType)[keyof typeof VisitType]

export const VisitTypeLabels: Record<VisitType, string> = {
  LECTURA: 'Lectura de contador',
  MANTENIMIENTO: 'Mantenimiento',
  INSTALACION: 'Instalación',
  RETIRO: 'Retiro',
  ENTREGA_INSUMOS: 'Entrega de insumos',
}

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
  REPARACION: 'REPARACION',
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

export const TipoComprobante = {
  INGRESO: 'I',
  EGRESO: 'E',
  TRASLADO: 'T',
  NOMINA: 'N',
  PAGO: 'P',
} as const
export type TipoComprobante = (typeof TipoComprobante)[keyof typeof TipoComprobante]

export const TipoComprobanteLabels: Record<TipoComprobante, string> = {
  I: 'Ingreso',
  E: 'Egreso',
  T: 'Traslado',
  N: 'Nomina',
  P: 'Pago',
}

export const EstadoConciliacion = {
  CONCILIADO: 'conciliado',
  SIN_FACTURA: 'sin_factura',
} as const
export type EstadoConciliacion = (typeof EstadoConciliacion)[keyof typeof EstadoConciliacion]

export const EstadoConciliacionLabels: Record<EstadoConciliacion, string> = {
  conciliado: 'Conciliado',
  sin_factura: 'Sin factura',
}

export const EstadoCliente = {
  ASIGNADO: 'asignado',
  SIN_CLIENTE: 'sin_cliente',
} as const
export type EstadoCliente = (typeof EstadoCliente)[keyof typeof EstadoCliente]

export const EstadoClienteLabels: Record<EstadoCliente, string> = {
  asignado: 'Asignado',
  sin_cliente: 'Sin cliente',
}

export const FieldRecordStatus = {
  PENDIENTE: 'PENDIENTE',
  VINCULADO: 'VINCULADO',
  DESCARTADO: 'DESCARTADO',
} as const
export type FieldRecordStatus = (typeof FieldRecordStatus)[keyof typeof FieldRecordStatus]

export const FieldRecordType = {
  LECTURA: 'LECTURA',
  ENTREGA_INSUMOS: 'ENTREGA_INSUMOS',
  OTRO: 'OTRO',
} as const
export type FieldRecordType = (typeof FieldRecordType)[keyof typeof FieldRecordType]

export const FieldRecordStatusLabels: Record<FieldRecordStatus, string> = {
  PENDIENTE: 'Pendiente',
  VINCULADO: 'Vinculado',
  DESCARTADO: 'Descartado',
}

export const FieldRecordTypeLabels: Record<FieldRecordType, string> = {
  LECTURA: 'Lectura',
  ENTREGA_INSUMOS: 'Entrega de insumos',
  OTRO: 'Otro',
}