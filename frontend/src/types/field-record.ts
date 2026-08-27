export { FieldRecordStatus, FieldRecordType } from './enums'
import type { FieldRecordStatus, FieldRecordType } from './enums'
import type { Contract, PrinterAssignment } from './contract'
import type { Printer } from './printer'

export interface FieldRecordArticuloEntregado {
  descripcion: string
  cantidad: number
}

/** Registro de campo (staging) tal cual lo devuelve la API (snake_case). */
export interface FieldRecord {
  id: number
  tipo: FieldRecordType
  estado: FieldRecordStatus
  nombre_cliente_reportado: string
  direccion_reportada?: string | null
  marca_reportada?: string | null
  modelo_reportada?: string | null
  num_serie_reportado?: string | null
  valor_contador?: number | null
  articulos_entregados?: FieldRecordArticuloEntregado[] | null
  notas?: string | null
  foto_evidencia?: string | null
  ubicacion_lat?: string | number | null
  ubicacion_lng?: string | number | null
  capturado_en: string
  client_uuid?: string | null
  socio_id: number
  socio_nombre?: string | null
  cliente_id?: number | null
  contrato_id?: number | null
  impresora_id?: number | null
  visita_id?: number | null
  lectura_id?: number | null
  vinculado_en?: string | null
  motivo_descarte?: string | null
  client?: { id: number; razon_social: string } | null
  contract?: Contract | null
  printer?: Printer | null
  visit?: { id: number; tipo_visita: string; estado: string } | null
  vinculado_por?: string | null
}

export interface LinkFieldRecordArticulo {
  articulo_id: number
  cantidad: number
}

/** Payload de POST /field-records/{id}/link */
export interface LinkFieldRecordPayload {
  cliente_id: number
  contrato_id: number
  impresora_id?: number
  justificacion_anomalia?: string
  articulos?: LinkFieldRecordArticulo[]
  tipo_visita?: string
  motivo_cierre?: string
}

/** Impresora activa del contrato (del resource de contratos). */
export type ContratoImpresora = PrinterAssignment
