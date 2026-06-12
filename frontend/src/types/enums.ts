export enum PrinterStatus {
  EN_ALMACEN = 'EN_ALMACEN',
  RENTADA = 'RENTADA',
  EN_MANTENIMIENTO = 'EN_MANTENIMIENTO',
  DADA_DE_BAJA = 'DADA_DE_BAJA',
}

export enum ContractStatus {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
}

export enum InvoiceStatus {
  PENDIENTE = 'PENDIENTE',
  PARCIALMENTE_PAGADA = 'PARCIALMENTE_PAGADA',
  PAGADA = 'PAGADA',
  VENCIDA = 'VENCIDA',
  INCOBRABLE = 'INCOBRABLE',
}

export enum VisitStatus {
  PENDIENTE = 'PENDIENTE',
  COMPLETADA = 'COMPLETADA',
  REPROGRAMADA = 'REPROGRAMADA',
  CANCELADA = 'CANCELADA',
}

export enum VisitType {
  LECTURA = 'LECTURA',
  MANTENIMIENTO = 'MANTENIMIENTO',
  INSTALACION = 'INSTALACION',
  RETIRO = 'RETIRO',
}

export enum PaymentMethod {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  DEPOSITO = 'DEPOSITO',
}

export enum VisitFrequency {
  MENSUAL = 'MENSUAL',
  QUINCENAL = 'QUINCENAL',
  SEMANAL = 'SEMANAL',
  CUSTOM = 'CUSTOM',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERADOR = 'OPERADOR',
}

export const PRINTER_STATUS_LABELS: Record<PrinterStatus, string> = {
  [PrinterStatus.EN_ALMACEN]: 'En Almacen',
  [PrinterStatus.RENTADA]: 'Rentada',
  [PrinterStatus.EN_MANTENIMIENTO]: 'En Mantenimiento',
  [PrinterStatus.DADA_DE_BAJA]: 'Dada de Baja',
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.ACTIVO]: 'Activo',
  [ContractStatus.SUSPENDIDO]: 'Suspendido',
  [ContractStatus.FINALIZADO]: 'Finalizado',
  [ContractStatus.CANCELADO]: 'Cancelado',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [InvoiceStatus.PENDIENTE]: 'Pendiente',
  [InvoiceStatus.PARCIALMENTE_PAGADA]: 'Parcialmente Pagada',
  [InvoiceStatus.PAGADA]: 'Pagada',
  [InvoiceStatus.VENCIDA]: 'Vencida',
  [InvoiceStatus.INCOBRABLE]: 'Incobrable',
}

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  [VisitStatus.PENDIENTE]: 'Pendiente',
  [VisitStatus.COMPLETADA]: 'Completada',
  [VisitStatus.REPROGRAMADA]: 'Reprogramada',
  [VisitStatus.CANCELADA]: 'Cancelada',
}

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  [VisitType.LECTURA]: 'Lectura',
  [VisitType.MANTENIMIENTO]: 'Mantenimiento',
  [VisitType.INSTALACION]: 'Instalacion',
  [VisitType.RETIRO]: 'Retiro',
}

export enum ArticleType {
  CONSUMIBLE = 'CONSUMIBLE',
  REPARACION = 'REPARACION',
}

export enum MovementType {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
}

export enum MaintenanceType {
  PREVENTIVO = 'PREVENTIVO',
  CORRECTIVO = 'CORRECTIVO',
}

export enum MaintenanceStatus {
  PROGRAMADA = 'PROGRAMADA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
}

export enum PurchaseStatus {
  PENDIENTE = 'PENDIENTE',
  RECIBIDA = 'RECIBIDA',
  CANCELADA = 'CANCELADA',
}

export enum SupplierPaymentMethod {
  TRANSFERENCIA = 'TRANSFERENCIA',
  EFECTIVO = 'EFECTIVO',
  CHEQUE = 'CHEQUE',
}

export enum ExpenseType {
  TRANSPORTE = 'TRANSPORTE',
  OTRO = 'OTRO',
}

export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  [ArticleType.CONSUMIBLE]: 'Consumible',
  [ArticleType.REPARACION]: 'Reparacion',
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  [MovementType.ENTRADA]: 'Entrada',
  [MovementType.SALIDA]: 'Salida',
  [MovementType.AJUSTE]: 'Ajuste',
}

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  [MaintenanceType.PREVENTIVO]: 'Preventivo',
  [MaintenanceType.CORRECTIVO]: 'Correctivo',
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PROGRAMADA]: 'Programada',
  [MaintenanceStatus.COMPLETADA]: 'Completada',
  [MaintenanceStatus.CANCELADA]: 'Cancelada',
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  [PurchaseStatus.PENDIENTE]: 'Pendiente',
  [PurchaseStatus.RECIBIDA]: 'Recibida',
  [PurchaseStatus.CANCELADA]: 'Cancelada',
}

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  [ExpenseType.TRANSPORTE]: 'Transporte',
  [ExpenseType.OTRO]: 'Otro',
}

export enum BankAccountType {
  CHEQUES = 'CHEQUES',
  DEBITO = 'DEBITO',
  AHORRO = 'AHORRO',
}

export enum Currency {
  MXN = 'MXN',
  USD = 'USD',
}

export enum BankName {
  BBVA = 'BBVA',
  SANTANDER = 'SANTANDER',
  BANCOMER = 'BANCOMER',
  HSBC = 'HSBC',
  OTRO = 'OTRO',
}

export enum ReconciliationStatus {
  CONCILIADO = 'CONCILIADO',
  PENDIENTE = 'PENDIENTE',
  NO_RECONOCIDO = 'NO_RECONOCIDO',
}

export enum BankMovementType {
  DEPOSITO = 'DEPOSITO',
  RETIRO = 'RETIRO',
}

export enum PeriodStatus {
  ABIERTO = 'ABIERTO',
  CERRADO = 'CERRADO',
}

export enum ValidationState {
  OK = 'OK',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  [BankAccountType.CHEQUES]: 'Cta. Cheques',
  [BankAccountType.DEBITO]: 'Tarjeta Deb.',
  [BankAccountType.AHORRO]: 'Cta. Ahorro',
}

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  [ReconciliationStatus.CONCILIADO]: 'Conciliada',
  [ReconciliationStatus.PENDIENTE]: 'Pendiente',
  [ReconciliationStatus.NO_RECONOCIDO]: 'No reconocido',
}

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  [PeriodStatus.ABIERTO]: 'Abierto',
  [PeriodStatus.CERRADO]: 'Cerrado',
}
