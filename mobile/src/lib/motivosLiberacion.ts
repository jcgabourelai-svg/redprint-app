import type { MotivoLiberacion } from '../types/api'

/**
 * Fuente única de etiquetas de motivo de liberación. `Record` acotado al
 * union: agregar una clave a MotivoLiberacion sin etiqueta es error de
 * compilación (antes de que una página muestre la clave cruda).
 */
export const MOTIVO_LIBERACION_LABEL: Record<MotivoLiberacion, string> = {
  SUSTITUCION_FALLA: 'Sustitución por falla',
  ROTACION: 'Rotación de flota',
  FIN_CONTRATO: 'Fin de contrato',
  CANCELACION_CONTRATO: 'Cancelación de contrato',
  OTRO: 'Otro',
}
