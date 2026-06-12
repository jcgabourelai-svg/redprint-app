import type { PrinterStatus } from './enums'

export interface Printer {
  id: string
  marca: string
  modelo: string
  numero_serie: string
  fecha_adquisicion: string
  costo_adquisicion: number
  vida_util_estimada: number
  estado: PrinterStatus
  ubicacion: string
  almacen?: string
  contador_total_actual: number
  ultima_lectura?: number
  fecha_ultima_lectura?: string
  vida_util_restante?: number
  garantia_hasta?: string
  garantia_status?: string
  codigo_negocio?: string
  stock_consumibles?: number
}

export interface PrinterHistory {
  id: string
  fecha: string
  tipo: string
  descripcion: string
  responsable: string
  detalles?: string
}

export interface Reading {
  id: string
  fecha: string
  contador: number
  consumo: number
  visitante: string
  estado: 'normal' | 'anomalia'
}

export interface PrinterDetail extends Printer {
  historial: PrinterHistory[]
  lecturas: Reading[]
}