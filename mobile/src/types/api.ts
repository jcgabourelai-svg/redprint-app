export type TipoVisita = 'LECTURA' | 'MANTENIMIENTO' | 'INSTALACION' | 'RETIRO'
export type VisitEstado = 'PENDIENTE' | 'COMPLETADA' | 'REPROGRAMADA' | 'CANCELADA' | 'OMITIDA'
export type PrinterEstado = 'EN_ALMACEN' | 'RENTADA' | 'EN_MANTENIMIENTO' | 'DADA_DE_BAJA'

export interface AuthUser {
  id: number
  nombre: string
  correo: string
  telefono: string | null
  rol_id: number | null
  rol_nombre: string | null
  rol_slug: string | null
  es_sistema: boolean
  permisos: string[]
  activo: boolean
  ultimo_acceso: string | null
  fecha_creacion: string | null
}

export interface VisitPrinter {
  id: string
  impresora_id: string
  marca: string
  modelo: string
  numero_serie: string | null
  contrato_id: string
  lectura_anterior: number
  fecha_lectura_anterior: string | null
}

export interface Reading {
  id: number
  visita_id: number
  impresora_id: number
  contrato_id: number | null
  fecha: string | null
  valor_contador: number
  lectura_anterior: number
  lectura_actual: number
  paginas_periodo: number | null
  paginas_consumidas: number | null
  es_anomalia: boolean
  excepcion: string | null
  justificacion_anomalia: string | null
  impresora_nombre?: string
  socio_capturista?: string
  evidencia_foto: string | null
}

export interface Visit {
  id: number
  cliente_id: number
  contrato_id: number | null
  tipo_visita: TipoVisita | null
  fecha_programada: string | null
  fecha_realizada: string | null
  socio_id: number | null
  cliente_nombre?: string
  socio_nombre?: string
  estado: VisitEstado | null
  notas: string | null
  impresoras?: VisitPrinter[]
  readings?: Reading[]
}

export interface StoreReadingResponse {
  reading: Reading
  paginas_consumidas: number
  monto_estimado: number | null
}

export interface WarehouseRef {
  id: number
  nombre: string
}

export interface Printer {
  id: number
  marca: string
  modelo: string
  num_serie: string | null
  num_inventario: string | null
  codigo_negocio: string | null
  estado: PrinterEstado | null
  contador_actual: number
  warehouse?: WarehouseRef | null
}

export interface Warehouse {
  id: number
  nombre: string
  direccion: string
  activo: boolean
  printers_count?: number
}

export interface AppNotification {
  id: number
  tipo: string | null
  titulo: string | null
  mensaje: string | null
  leida: boolean
  referencia_tipo: string | null
  referencia_id: number | null
  fecha: string | null
}

export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
  links: Record<string, string | null>
}

export interface Collection<T> {
  data: T[]
}
