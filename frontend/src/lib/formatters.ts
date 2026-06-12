export function formatCurrency(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return 'N/A'
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(n)
}

export function formatDate(date?: string | null): string {
  if (!date) {
    return '-'
  }
  const d = new Date(date)
  if (isNaN(d.getTime())) {
    return '-'
  }
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatDateTime(date: string): string {
  const d = new Date(date)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

export function getPrinterStatusColor(status: string): string {
  const colors: Record<string, string> = {
    disponible: 'bg-green-100 text-green-800',
    ocupada: 'bg-yellow-100 text-yellow-800',
    mantenimiento: 'bg-orange-100 text-orange-800',
    fuera_servicio: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'text-gray-600'
}

export function getContractStatusColor(status: string): string {
  const colors: Record<string, string> = {
    activo: 'bg-green-100 text-green-800',
    pendiente: 'bg-yellow-100 text-yellow-800',
    vencido: 'bg-red-100 text-red-800',
    cancelado: 'bg-gray-100 text-gray-800',
  }
  return colors[status] || 'text-gray-600'
}

export function getInvoiceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pagada: 'bg-green-100 text-green-800',
    pendiente: 'bg-yellow-100 text-yellow-800',
    vencida: 'bg-red-100 text-red-800',
    anulada: 'bg-gray-100 text-gray-800',
  }
  return colors[status] || 'text-gray-600'
}

export function getVisitStatusColor(status: string): string {
  const colors: Record<string, string> = {
    programada: 'bg-blue-100 text-blue-800',
    en_curso: 'bg-purple-100 text-purple-800',
    completada: 'bg-green-100 text-green-800',
    cancelada: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'text-gray-600'
}

export function getMaintenanceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    programada: 'bg-blue-100 text-blue-800',
    en_progreso: 'bg-yellow-100 text-yellow-800',
    completada: 'bg-green-100 text-green-800',
    cancelada: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'text-gray-600'
}

export function getMovementTypeColor(type: string): string {
  const colors: Record<string, string> = {
    entrada: 'bg-green-100 text-green-800',
    salida: 'bg-red-100 text-red-800',
    transferencia: 'bg-blue-100 text-blue-800',
  }
  return colors[type] || 'text-gray-600'
}