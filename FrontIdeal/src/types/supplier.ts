export interface Supplier {
  id: string
  nombre: string
  rfc?: string
  contacto: string
  telefono: string
  email?: string
  direccion: string
  notas?: string
  activo: boolean
  fecha_creacion: string
  ultimo_pedido?: string
}