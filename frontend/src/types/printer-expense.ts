export interface PrinterExpense {
  id: string
  impresora_id: string
  impresora_marca: string
  impresora_modelo: string
  fecha: string
  concepto: string
  monto: number
  categoria: string
  referencia?: string
  socio_registro: string
  comprobante?: string
  notas?: string
}