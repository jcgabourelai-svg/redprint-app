import type { PrinterStatus } from './enums'

export type PrinterCondition = 'OPERATIVA' | 'REQUIERE_ATENCION' | 'NO_OPERATIVA' | 'PIEZAS'

export interface Printer {
  id: string
  marca: string
  modelo: string
  printer_model_id?: number
  num_serie: string
  num_inventario?: string
  fecha_adquisicion: string
  costo_adquisicion: number
  vida_util_estimada: number
  estado: PrinterStatus
  condicion?: PrinterCondition | null
  condicion_nota?: string | null
  condicion_actualizada_en?: string | null
  disponible_para_renta?: boolean
  ubicacion: string
  warehouse?: { id: number; nombre: string; direccion?: string | null } | null
  cliente?: { id: number; nombre: string; contrato_id?: number; contrato_codigo?: string } | null
  contador_actual: number
  ultima_lectura?: number
  fecha_ultima_lectura?: string
  vida_util_restante?: number
  garantia_hasta?: string
  garantia_status?: string
  codigo_negocio?: string
  stock_consumibles?: number
  ordenes_abiertas_count?: number
  open_maintenance_order?: {
    id: number
    tipo_mantto: 'PREVENTIVO' | 'CORRECTIVO'
    estado?: string
    fecha?: string
  } | null
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