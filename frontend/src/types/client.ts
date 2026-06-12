export interface Client {
  id: string
  razon_social: string
  rfc?: string
  nombre_contacto: string
  telefono: string
  correo?: string
  direccion_instalacion: string
  notas?: string
  contratos_activos_count?: number
  saldo_pendiente?: number
  estado?: 'al_corriente' | 'pendiente' | 'vencido'
  rentabilidad?: number
}