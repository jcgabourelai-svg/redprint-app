import type { Printer } from '@/types/printer'

export interface Warehouse {
  id: string
  nombre: string
  direccion: string
  encargado: string
  telefono?: string
  ocupacion_actual: number
  estado: 'activo' | 'inactivo'
  notas?: string
  fecha_creacion: string
  fecha_ultima_actualizacion?: string
}

export interface WarehouseDetail extends Warehouse {
  impresoras: Printer[]
}

export interface WarehouseFormData {
  nombre: string
  direccion: string
  encargado: string
  telefono?: string
  estado: 'activo' | 'inactivo'
  notas?: string
}