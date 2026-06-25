import type { Printer } from '@/types/printer'

export interface WarehouseResponsable {
  id: number
  nombre?: string
  correo?: string
  telefono?: string
}

export interface Warehouse {
  id: number
  nombre: string
  direccion: string
  responsable_id?: number | null
  responsable?: WarehouseResponsable | null
  activo: boolean
  printers_count?: number
  created_at?: string
  updated_at?: string
}

export interface WarehouseDetail extends Warehouse {
  printers?: Printer[]
}

export interface WarehouseFormData {
  nombre: string
  direccion: string
  responsable_id?: number | null
  activo: boolean
}
