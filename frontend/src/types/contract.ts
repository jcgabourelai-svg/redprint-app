export { ContractStatus, VisitFrequency } from './enums'
import { ContractStatus, VisitFrequency } from './enums'

export interface PrinterAssignment {
  id: string
  impresora_id: string
  impresora_marca: string
  impresora_modelo: string
  impresora_serie: string
  fecha_asignacion: string
  lectura_inicial: number
  contador_actual: number
  paginas_del_periodo: number
  estimado_del_periodo: number
  rentabilidad_acumulada: number
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
  estado: ContractStatus
  impresoras: PrinterAssignment[]
  codigo_negocio?: string
  dias_adelanto?: number
  rentabilidad?: number
  ingresos?: number
  costos?: number
  margen?: number
  proxima_visita?: string
  visitas_programadas?: string[]
  facturas?: string[]
}