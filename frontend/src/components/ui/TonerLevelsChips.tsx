import { cn } from '@/lib/utils'
import type { TonerLevels } from '@/types/toner'

// Record<keyof TonerLevels, ...> obliga a que una clave nueva del contrato
// (k/c/m/y) se reflele aquí o el compilador falla.
const ROW_BY_KEY: Record<keyof TonerLevels, { label: string; dot: string }> = {
  k: { label: 'Negro', dot: 'bg-gray-900' },
  c: { label: 'Cian', dot: 'bg-cyan-500' },
  m: { label: 'Magenta', dot: 'bg-fuchsia-500' },
  y: { label: 'Amarillo', dot: 'bg-yellow-400 border border-yellow-600' },
}

const ROWS = (Object.keys(ROW_BY_KEY) as (keyof TonerLevels)[]).map((key) => ({
  key,
  label: ROW_BY_KEY[key].label,
  dot: ROW_BY_KEY[key].dot,
}))

/** Chips de niveles de tóner capturados (K/C/M/Y, %). Nivel ≤ 20% resalta como bajo. */
export default function TonerLevelsChips({
  levels,
  className = '',
}: {
  levels: TonerLevels | null | undefined
  className?: string
}) {
  const rows = ROWS.filter((r) => levels?.[r.key] != null)
  if (rows.length === 0) return null

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {rows.map((r) => {
        const v = Number(levels![r.key])
        const low = v <= 20
        return (
          <span
            key={r.key}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              low ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
            )}
          >
            <span aria-hidden="true" className={cn('inline-block h-2.5 w-2.5 rounded-full', r.dot)} />
            {r.label} {v}%
          </span>
        )
      })}
    </span>
  )
}
