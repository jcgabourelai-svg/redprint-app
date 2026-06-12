export { VisitStatus, VisitType } from './enums'
import type { VisitStatus, VisitType } from './enums'

export interface VisitPrinter {
  id: string
  impresora_id: string
  marca: string
  modelo: string
  numero_serie: string
  contrato_id: string
  lectura_anterior: number
  fecha_lectura_anterior: string
  lectura_actual?: number
  paginas_consumidas?: number
}

export interface Visit {
  id: string
  cliente_id: string
  cliente_nombre: string
  tipo_visita: VisitType
  fecha_programada: string
  hora_programada: string
  socio_asignado: string
  estado: VisitStatus
  notas?: string
  impresoras: VisitPrinter[]
  direccion_cliente?: string
  duracion_estimada?: string
}

export interface Reading {
  id: string
  visita_id: string
  impresora_id: string
  impresora_nombre: string
  lectura_anterior: number
  lectura_actual: number
  paginas_consumidas: number
  fecha: string
  hora: string
  socio_capturista: string
  evidencia_foto?: string
  excepcion?: string
}

export interface ReadingSession {
  id: string
  visita_id: string
  cliente_id: string
  cliente_nombre: string
  fecha: string
  lecturas: Reading[]
  monto_estimado: number
  observaciones?: string
}