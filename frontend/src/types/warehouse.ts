import type { Printer } from '@/types/printer'

export interface Warehouse {
  id: string
  nombre: string
  direccion: string
  encargado: string
  telefono?: string
  capacidad: number
  ocupacion_actual: number
  estado: 'activo' | 'inactivo'
  notas?: string
  fecha_creacion: string
  fecha_ultima_actualizacion?: string
}

export interface WarehouseDetail extends Warehouse {
  impresoras: Printer[]
  porcentaje_ocupacion: number
  disponibilidad: number
}

export interface WarehouseFormData {
  nombre: string
  direccion: string
  encargado: string
  telefono?: string
  capacidad: number
  estado: 'activo' | 'inactivo'
  notas?: string
}