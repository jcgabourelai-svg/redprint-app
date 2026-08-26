export const problemTypeLabels: Record<string, string> = {
  NO_IMPRIME: 'No imprime',
  CALIDAD_DEFICIENTE: 'Calidad deficiente',
  ATASCOS: 'Atascos',
  ERROR_PANTALLA: 'Error en pantalla',
  OTRO: 'Otro',
}

export const severityLabels: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
}

export function severityBadgeVariant(severity: string): 'success' | 'warning' | 'error' {
  switch (severity) {
    case 'BAJA':
      return 'success'
    case 'MEDIA':
      return 'warning'
    default:
      return 'error'
  }
}
