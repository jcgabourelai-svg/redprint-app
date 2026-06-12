export interface Reading {
  id: string
  visita_id: string
  impresora_id: string
  impresora_nombre?: string
  valor_contador?: number
  lectura_anterior?: number
  lectura_actual?: number
  paginas_periodo?: number
  paginas_consumidas?: number
  fecha: string
  hora?: string
  socio_capturista?: string
  evidencia_foto?: string
  es_anomalia?: boolean
  excepcion?: string | null
  justificacion_anomalia?: string | null
}