export { ContractStatus, VisitFrequency } from './enums'
import { ContractStatus, VisitFrequency } from './enums'

export type MotivoLiberacion =
  | 'SUSTITUCION_FALLA'
  | 'FIN_CONTRATO'
  | 'CANCELACION_CONTRATO'
  | 'ROTACION'
  | 'OTRO'

export const MotivoLiberacionLabels: Record<MotivoLiberacion, string> = {
  SUSTITUCION_FALLA: 'Sustitución por falla',
  FIN_CONTRATO: 'Fin de contrato',
  CANCELACION_CONTRATO: 'Cancelación de contrato',
  ROTACION: 'Rotación de flota',
  OTRO: 'Otro',
}

export interface PrinterAssignment {
  id: string
  impresora_id: string
  impresora_marca: string
  impresora_modelo: string
  impresora_serie: string
  alias?: string | null
  color?: string | null
  fecha_asignacion: string
  fecha_liberacion?: string | null
  activa?: boolean
  lectura_inicial: number
  lectura_final?: number | null
  fecha_lectura_final?: string | null
  motivo_liberacion?: MotivoLiberacion | null
  justificacion_sin_lectura?: string | null
  reemplaza_a?: string | null
  reemplazada_por_id?: string | null
  reemplazada_por_impresora_id?: string | null
  contador_actual: number
  paginas_del_periodo: number
  estimado_del_periodo: number
  rentabilidad_acumulada: number
}

export interface ContractPlanRow {
  id: number
  modelo_id: number
  marca: string | null
  modelo_nombre: string | null
  cantidad: number
  instaladas: number | null
}

export interface Contract {
  id: string
  cliente_id: string
  cliente_nombre: string
  cliente_contacto: string
  cliente_rfc?: string
  fecha_inicio: string
  fecha_fin?: string
  tarifa_base: number
  paginas_incluidas: number
  costo_por_pagina_excedente: number
  dias_gracia: number
  frecuencia_visitas: VisitFrequency
  dia_visita?: number | null
  estado: ContractStatus
  impresoras: PrinterAssignment[]
  plan_impresoras?: ContractPlanRow[]
  pendientes_instalacion?: number
  active_printers_count?: number
  printers?: {
    id: string
    marca: string
    modelo: string
    num_serie: string
  }[]
  codigo_negocio?: string
  dias_adelanto?: number
  rentabilidad?: number
  ingresos?: number
  costos?: number
  margen?: number
  /** Estimado del periodo actual (intención comercial); NO es ingreso cobrado. */
  estimado_periodo_total?: number | null
  proxima_visita?: string
  visitas_programadas?: string[]
  facturas?: string[]
}