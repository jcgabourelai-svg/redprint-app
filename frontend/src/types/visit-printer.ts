export interface VisitPrinter {
  id: string
  impresora_id: string
  marca: string
  modelo: string
  numero_serie: string
  contrato_id: string
  lectura_anterior: number
  fecha_lectura_anterior: string
  lectura_actual?: number
  paginas_consumidas?: number
}