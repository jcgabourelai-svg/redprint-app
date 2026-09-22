import type { PrinterCondition } from '@/types/printer'

export const printerConditionLabels: Record<string, string> = {
  OPERATIVA: 'Operativa',
  REQUIERE_ATENCION: 'Requiere atención',
  NO_OPERATIVA: 'No operativa',
  PIEZAS: 'Donante de piezas',
}

export const printerConditionBadgeClass: Record<string, string> = {
  OPERATIVA: 'border-success/40 bg-success/10 text-success',
  REQUIERE_ATENCION: 'border-warning/40 bg-warning/10 text-warning',
  NO_OPERATIVA: 'border-destructive/40 bg-destructive/10 text-destructive',
  PIEZAS: 'border-muted-foreground/40 bg-muted text-muted-foreground',
}

export function printerConditionLabel(condicion?: string | null): string {
  if (!condicion) return 'Sin condición'
  return printerConditionLabels[condicion] ?? condicion
}

export function ConditionChip({ condicion, compact = false }: { condicion?: PrinterCondition | null; compact?: boolean }) {
  if (!condicion) {
    return compact ? <span className="text-xs text-muted-foreground">—</span> : null
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${printerConditionBadgeClass[condicion] ?? 'border-border bg-muted text-muted-foreground'}`}
      title={printerConditionLabel(condicion)}
    >
      {printerConditionLabel(condicion)}
    </span>
  )
}
