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

export interface VisitDelivery {
  id: number
  articulo_id: number
  cantidad: number
  costo_unitario: string | number | null
  subtotal: string | number | null
  article?: { nombre: string; marca: string | null; modelo_sku: string | null } | null
}

export interface VisitMaintenanceOrder {
  id: number
  impresora_id: number
  fecha: string | null
  tipo_mantto: string | null
  desc_problema: string | null
  tipo_problema: string | null
  severidad: string | null
  trabajo_realizado: string | null
  estado: string | null
  visita_id: number | null
  printer?: { id: number; marca: string; modelo: string; num_serie?: string | null } | null
}

export interface VisitPrinterChange {
  evento: string
  fecha: string | null
  impresora: { id: number; marca: string; modelo: string; num_serie: string | null } | null
}

export interface VisitReading {
  id: number
  visita_id: number
  impresora_id: number
  contrato_id?: number | null
  fecha: string | null
  valor_contador: number
  lectura_anterior: number
  lectura_actual: number
  paginas_periodo: number | null
  paginas_consumidas: number | null
  es_anomalia: boolean
  justificacion_anomalia?: string | null
  socio_capturista?: string
}

export interface Visit {
  id: string
  cliente_id: string
  cliente_nombre: string
  contrato_id?: string
  tipo_visita: VisitType
  fecha_programada: string
  socio_id?: string
  socio_nombre?: string
  hora_programada?: string
  estado: VisitStatus
  notas?: string
  motivo_cierre?: string | null
  impresoras?: VisitPrinter[]
  direccion_cliente?: string
  duracion_estimada?: string
  client?: unknown
  contract?: unknown
  socio?: unknown
  readings?: VisitReading[]
  entregas?: VisitDelivery[]
  mantenimientos?: VisitMaintenanceOrder[]
  cambios_impresoras?: VisitPrinterChange[]
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