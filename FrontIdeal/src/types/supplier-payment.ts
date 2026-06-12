import type { PaymentMethod } from './enums'

export interface SupplierPayment {
  id: string
  proveedor_id: string
  proveedor_nombre: string
  compra_id?: string
  fecha: string
  monto: number
  metodo: PaymentMethod
  cuenta_bancaria_id?: string
  socio_registro: string
  comprobante?: string
  referencia?: string
  notas?: string
}