export type TipoVisita =
  | 'LECTURA'
  | 'MANTENIMIENTO'
  | 'INSTALACION'
  | 'RETIRO'
  | 'ENTREGA_INSUMOS'
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
  alias?: string | null
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

export type TipoProblema = 'NO_IMPRIME' | 'CALIDAD_DEFICIENTE' | 'ATASCOS' | 'ERROR_PANTALLA' | 'OTRO'
export type Severidad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'

export interface MaintenanceOrder {
  id: number
  impresora_id: number
  fecha: string | null
  tipo_mantto: 'PREVENTIVO' | 'CORRECTIVO' | null
  desc_problema: string | null
  tipo_problema: TipoProblema | null
  severidad: Severidad | null
  foto_evidencia: string | null
  trabajo_realizado: string | null
  estado: string | null
  visita_id: number | null
  printer?: {
    id: number
    marca: string
    modelo: string
    num_serie?: string | null
  } | null
}

export interface PrinterChange {
  evento: string
  fecha: string | null
  alias?: string | null
  impresora: {
    id: number
    marca: string
    modelo: string
    num_serie: string | null
  } | null
}

export interface VisitClient {
  id: number
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  correo: string | null
  direccion_instalacion: string | null
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
  motivo_cierre: string | null
  origen: string | null
  client?: VisitClient
  impresoras?: VisitPrinter[]
  readings?: Reading[]
  entregas?: ArticleDelivery[]
  mantenimientos?: MaintenanceOrder[]
  cambios_impresoras?: PrinterChange[]
}

export interface ClientOption {
  id: number
  razon_social: string
  contratos: { id: number; codigo_negocio: string }[]
}

export interface Article {
  id: number
  tipo_articulo: string | null
  subtipo: string | null
  nombre: string
  marca: string | null
  modelo_sku: string | null
  stock_actual: number
  umbral_reposicion: number
  costo_unitario: string | number | null
  activo: boolean
  fecha_creacion: string | null
}

export interface ArticleDelivery {
  id: number
  articulo_id: number
  visita_id: number
  contrato_id: number | null
  cliente_id: number
  cantidad: number
  costo_unitario: string | number | null
  subtotal: string | number | null
  notas: string | null
  article?: { id: number; nombre: string; marca: string | null; modelo_sku: string | null; subtipo: string | null } | null
  fecha_creacion: string | null
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
