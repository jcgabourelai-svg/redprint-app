import type { PaymentMethod } from './enums'

export interface Payment {
  id: string
  factura_id?: string
  compra_id?: string
  fecha: string
  monto: number
  metodo: PaymentMethod
  cuenta_bancaria_id?: string
  cuenta_bancaria_nombre?: string
  socio_registro: string
  comprobante?: string
  referencia?: string
}