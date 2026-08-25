const longFmt = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const dayFmt = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
})
const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const numFmt = new Intl.NumberFormat('es-MX')

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha'
  return longFmt.format(parseISODate(iso.slice(0, 10)))
}

export function formatDayLabel(iso: string): string {
  return dayFmt.format(parseISODate(iso.slice(0, 10)))
}

export function formatMonthLabel(year: number, month: number): string {
  return monthFmt.format(new Date(year, month - 1, 1))
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return dateTimeFmt.format(new Date(iso))
}

export function formatNumber(n: number | null | undefined): string {
  return n == null ? '-' : numFmt.format(n)
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return 'N/D'
  return `$${n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function prevMonth(cursor: { year: number; month: number }): { year: number; month: number } {
  return cursor.month === 1
    ? { year: cursor.year - 1, month: 12 }
    : { year: cursor.year, month: cursor.month - 1 }
}

export function nextMonth(cursor: { year: number; month: number }): { year: number; month: number } {
  return cursor.month === 12
    ? { year: cursor.year + 1, month: 1 }
    : { year: cursor.year, month: cursor.month + 1 }
}
